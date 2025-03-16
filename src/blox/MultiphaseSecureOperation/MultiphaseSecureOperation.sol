// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MultiPhaseSecureOperation
 * @dev A library for implementing secure multi-phase operations with time-locks and meta-transactions
 * 
 * This library provides a comprehensive framework for creating secure operations that require
 * multiple phases of approval before execution. It supports:
 * 
 * - Time-locked operations that can only be executed after a waiting period
 * - Meta-transactions for gasless approvals
 * - Role-based access control for different operation types
 * - Multiple execution types (standard function calls or raw transaction data)
 * - Payment handling for both native tokens and ERC20 tokens
 * 
 * The library is designed to be used as a building block for secure smart contract systems
 * that require high levels of security and flexibility.
 */
library MultiPhaseSecureOperation {
    enum TxStatus {
        UNDEFINED,
        PENDING,
        CANCELLED,
        COMPLETED,
        FAILED,
        REJECTED
    }

    enum ExecutionType {
        NONE,
        STANDARD,
        RAW
    }

    struct StandardExecutionOptions {
        bytes4 functionSelector;
        bytes params;
    }

    struct RawExecutionOptions {
        bytes rawTxData;
    }

    struct TxParams {
        address requester;
        address target;
        uint256 value;
        uint256 gasLimit;
        bytes32 operationType;
        ExecutionType executionType;
        bytes executionOptions;
    }

    struct MetaTxParams {
        uint256 chainId;
        uint256 nonce;
        address handlerContract;
        bytes4 handlerSelector;
        uint256 deadline;
        uint256 maxGasPrice;
        // uint256 maxBasePrice; // optional for evm with EIP1559 support (can add a function to check if supported)
        address signer;
    }

    struct TxRecord {
        uint256 txId;
        uint256 releaseTime;
        TxStatus status;
        TxParams params;
        bytes result;
        PaymentDetails payment;
    }

    struct MetaTransaction {
        TxRecord txRecord;
        MetaTxParams params;
        bytes32 message;
        bytes signature;
        bytes data;
    }

    struct PaymentDetails {
        address recipient;
        uint256 nativeTokenAmount;
        address erc20TokenAddress;
        uint256 erc20TokenAmount;
    }

    struct ReadableOperationType {
        bytes32 operationType;
        string name;
    }

    struct SecureOperationState {
        // Frequently accessed mappings
        mapping(uint256 => TxRecord) txRecords;
        mapping(bytes32 => address) roles;
        mapping(address => bool) authorizedSigners;
        
        // Less frequently accessed mappings
        mapping(bytes32 => bytes32[]) allowedRolesForFunction;
        mapping(bytes32 => bool) supportedOperationTypes;
        mapping(bytes32 => string) operationTypeNames;
        
        // Frequently accessed values
        uint256 txCounter;
        uint256 metaTxNonce;
        uint256 timeLockPeriodInMinutes;

        // Lists that grow over time
        bytes32[] supportedOperationTypesList;
    }

    bytes32 constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 constant BROADCASTER_ROLE = keccak256("BROADCASTER_ROLE");
    bytes32 constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");

    // EIP-712 Type Hashes
    bytes32 private constant TYPE_HASH = keccak256("MetaTransaction(TxRecord txRecord,MetaTxParams params,bytes data)TxRecord(uint256 txId,uint256 releaseTime,uint8 status,TxParams params,bytes result,PaymentDetails payment)TxParams(address requester,address target,uint256 value,uint256 gasLimit,bytes32 operationType,uint8 executionType,bytes executionOptions)MetaTxParams(uint256 chainId,uint256 nonce,address handlerContract,bytes4 handlerSelector,uint256 deadline,uint256 maxGasPrice,address signer)PaymentDetails(address recipient,uint256 nativeTokenAmount,address erc20TokenAddress,uint256 erc20TokenAmount)");
    bytes32 private constant DOMAIN_SEPARATOR_TYPE_HASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // Function Selectors
    bytes4 private constant TX_REQUEST_SELECTOR = bytes4(keccak256("txRequest(address,address,uint256,uint256,bytes32,uint8,bytes)"));
    bytes4 private constant TX_DELAYED_APPROVAL_SELECTOR = bytes4(keccak256("txDelayedApproval(uint256)"));
    bytes4 private constant TX_CANCELLATION_SELECTOR = bytes4(keccak256("txCancellation(uint256)"));
    bytes4 private constant META_TX_APPROVAL_SELECTOR = bytes4(keccak256("txApprovalWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes,(address,uint256,address,uint256)),(uint256,address,bytes4,uint256,uint256,uint256,address),bytes,bytes)"));
    bytes4 private constant META_TX_CANCELLATION_SELECTOR = bytes4(keccak256("txCancellationWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes,(address,uint256,address,uint256)),(uint256,address,bytes4,uint256,uint256,uint256,address),bytes,bytes)"));
    bytes4 private constant META_TX_REQUEST_AND_APPROVE_SELECTOR = bytes4(keccak256("requestAndApprove((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes,(address,uint256,address,uint256)),(uint256,address,bytes4,uint256,uint256,uint256,address),bytes,bytes)"));

    event RequestedTx(uint256 indexed txId, uint256 releaseTime, address target, ExecutionType executionType, bytes executionOptions);
    event TxApproved(uint256 indexed txId);
    event TxCancelled(uint256 indexed txId);
    event TxExecuted(uint256 indexed txId, bool success, bytes result);


    /**
     * @dev Initializes the SecureOperationState with the specified time lock period and roles.
     * @param self The SecureOperationState to initialize.
     * @param _timeLockPeriodInMinutes The time lock period in minutes.
     * @param _owner The address of the owner.
     * @param _broadcaster The address of the broadcaster.
     */
    function initialize(
        SecureOperationState storage self,
        address _owner,
        address _broadcaster,
        address _recovery,
        uint256 _timeLockPeriodInMinutes
    ) public {
        require(_owner != address(0), "Invalid owner address");
        require(_broadcaster != address(0), "Invalid broadcaster address");
        require(_timeLockPeriodInMinutes > 0, "Invalid time lock period");

        self.timeLockPeriodInMinutes = _timeLockPeriodInMinutes;
        self.txCounter = 0;

        // Add owner role permissions
        addRole(self, OWNER_ROLE, _owner);
        addRoleForFunction(self, TX_REQUEST_SELECTOR, OWNER_ROLE);
        addRoleForFunction(self, TX_DELAYED_APPROVAL_SELECTOR, OWNER_ROLE);
        addRoleForFunction(self, TX_CANCELLATION_SELECTOR, OWNER_ROLE);

        // Add broadcaster role permissions
        addRole(self, BROADCASTER_ROLE, _broadcaster);
        addRoleForFunction(self, META_TX_APPROVAL_SELECTOR, BROADCASTER_ROLE);
        addRoleForFunction(self, META_TX_REQUEST_AND_APPROVE_SELECTOR, BROADCASTER_ROLE);
        addRoleForFunction(self, META_TX_CANCELLATION_SELECTOR, BROADCASTER_ROLE);

        // Add recovery role permissions
        addRole(self, RECOVERY_ROLE, _recovery);
        addRoleForFunction(self, TX_REQUEST_SELECTOR, RECOVERY_ROLE);
        addRoleForFunction(self, TX_DELAYED_APPROVAL_SELECTOR, RECOVERY_ROLE);
        addRoleForFunction(self, TX_CANCELLATION_SELECTOR, RECOVERY_ROLE);
    }

    /**
     * @dev Retrieves the owner address from the roles mapping.
     * @param self The SecureOperationState to check.
     * @return The address of the owner.
     */
    function getOwner(SecureOperationState storage self) public view returns (address) {
        return self.roles[OWNER_ROLE];
    }

    /**
     * @dev Gets the transaction record by its ID.
     * @param self The SecureOperationState to check.
     * @param txId The ID of the transaction to check.
     * @return The TxRecord associated with the transaction ID.
     */
    function getTxRecord(SecureOperationState storage self, uint256 txId) public view returns (TxRecord memory) {
        return self.txRecords[txId];
    }

    /**
     * @dev Requests a transaction with the specified parameters.
     * @param self The SecureOperationState to modify.
     * @param requester The address of the requester.
     * @param target The target contract address for the transaction.
     * @param value The value to send with the transaction.
     * @param gasLimit The gas limit for the transaction.
     * @param operationType The type of operation.
     * @param executionType The type of execution (STANDARD or RAW).
     * @param executionOptions The execution options for the transaction.
     * @return The created TxRecord.
     */
    function txRequest(
        SecureOperationState storage self,
        address requester,
        address target,
        uint256 value,
        uint256 gasLimit,
        bytes32 operationType,
        ExecutionType executionType,
        bytes memory executionOptions
    ) public returns (TxRecord memory) {
        require(checkPermissionPermissive(self, TX_REQUEST_SELECTOR) || checkPermissionPermissive(self,META_TX_REQUEST_AND_APPROVE_SELECTOR),"Caller does not have permission to execute this function");
        require(target != address(0), "Invalid target address");
        require(isOperationTypeSupported(self, operationType), "Operation type not supported");

        TxRecord memory txRequestRecord = createNewTxRecord(
            self,
            requester,
            target,
            value,
            gasLimit,
            operationType,
            executionType,
            executionOptions
        );

        self.txRecords[txRequestRecord.txId] = txRequestRecord;
        setNextTxId(self);

        emit RequestedTx(txRequestRecord.txId, txRequestRecord.releaseTime, txRequestRecord.params.target, txRequestRecord.params.executionType, txRequestRecord.params.executionOptions);

        return txRequestRecord;
    }

    /**
     * @dev Approves a pending transaction after the release time.
     * @param self The SecureOperationState to modify.
     * @param txId The ID of the transaction to approve.
     * @return The updated TxRecord.
     */
    function txDelayedApproval(SecureOperationState storage self, uint256 txId) public returns (TxRecord memory) {
        checkPermission(self, TX_DELAYED_APPROVAL_SELECTOR);
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only approve pending requests");
        require(block.timestamp >= self.txRecords[txId].releaseTime, "Current time is before release time");

        (bool success, bytes memory result) = executeTransaction(self.txRecords[txId]);

        // Update storage with new status and result
        if (success) {
            self.txRecords[txId].status = TxStatus.COMPLETED;
            self.txRecords[txId].result = result;
        } else {
            self.txRecords[txId].status = TxStatus.FAILED;
        }

        emit TxApproved(txId);
        emit TxExecuted(txId, success, result);

        return self.txRecords[txId];
    }

    /**
     * @dev Cancels a pending transaction.
     * @param self The SecureOperationState to modify.
     * @param txId The ID of the transaction to cancel.
     * @return The updated TxRecord.
     */
    function txCancellation(SecureOperationState storage self, uint256 txId) public returns (TxRecord memory) {
        checkPermission(self, TX_CANCELLATION_SELECTOR);
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only cancel pending requests");

        self.txRecords[txId].status = TxStatus.CANCELLED;
        emit TxCancelled(txId);

        return self.txRecords[txId];
    }

    /**
     * @dev Cancels a pending transaction using a meta-transaction.
     * @param self The SecureOperationState to modify.
     * @param metaTx The meta-transaction containing the signature and nonce.
     * @return The updated TxRecord.
     */
    function txCancellationWithMetaTx(SecureOperationState storage self, MetaTransaction memory metaTx) public returns (TxRecord memory) {
        uint256 txId = metaTx.txRecord.txId;
        checkPermission(self, META_TX_CANCELLATION_SELECTOR);
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only cancel pending requests");
        require(verifySignature(self, metaTx), "Invalid signature");

        self.metaTxNonce++;
        self.txRecords[txId].status = TxStatus.CANCELLED;
        emit TxCancelled(txId);

        return self.txRecords[txId];
    }

    /**
     * @dev Approves a pending transaction immediately using a meta-transaction.
     * @param self The SecureOperationState to modify.
     * @param metaTx The meta-transaction containing the signature and nonce.
     * @return The updated TxRecord.
     */
    function txApprovalWithMetaTx(SecureOperationState storage self, MetaTransaction memory metaTx) public returns (TxRecord memory) {
        uint256 txId = metaTx.txRecord.txId;
        checkPermission(self, META_TX_APPROVAL_SELECTOR);
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only approve pending requests");
        require(verifySignature(self, metaTx), "Invalid signature");

        self.metaTxNonce++;
        (bool success, bytes memory result) = executeTransaction(self.txRecords[txId]);

        // Update storage with new status and result
        if (success) {
            self.txRecords[txId].status = TxStatus.COMPLETED;
            self.txRecords[txId].result = result;
        } else {
            self.txRecords[txId].status = TxStatus.FAILED;
        }

        emit TxApproved(txId);
        emit TxExecuted(txId, success, result);

        return self.txRecords[txId];
    }

    /**
     * @dev Requests and immediately approves a transaction.
     * @param self The SecureOperationState to modify.
     * @param metaTx The meta-transaction containing the signature and nonce.
     * @return The updated TxRecord.
     */
    function requestAndApprove(
        SecureOperationState storage self,
        MetaTransaction memory metaTx
    ) public returns (TxRecord memory) {
        checkPermission(self, META_TX_REQUEST_AND_APPROVE_SELECTOR);

        TxRecord memory txRecord = txRequest(
            self,
            metaTx.txRecord.params.requester,
            metaTx.txRecord.params.target,
            metaTx.txRecord.params.value,
            metaTx.txRecord.params.gasLimit,
            metaTx.txRecord.params.operationType,
            metaTx.txRecord.params.executionType,
            metaTx.txRecord.params.executionOptions
        );

        metaTx.txRecord = txRecord;
        return txApprovalWithMetaTx(self, metaTx);
    }

    /**
     * @dev Executes a transaction based on its execution type.
     * @param record The transaction record to execute.
     * @return A tuple containing the success status and result of the execution.
     */
    function executeTransaction(TxRecord memory record) private returns (bool, bytes memory) {
        bytes memory txData = prepareTransactionData(record);
        uint gas = record.params.gasLimit;
        if (gas == 0) {
            gas = gasleft();
        }
        (bool success, bytes memory result) = record.params.target.call{value: record.params.value, gas: gas}(
            txData
        );

        if (success) {
            record.status = TxStatus.COMPLETED;
            record.result = result;
        } else {
            record.status = TxStatus.FAILED;
        }

        return (success, result);
    }

    /**
     * @dev Prepares transaction data based on execution type without executing it.
     * @param record The transaction record to prepare data for.
     * @return The prepared transaction data.
     */
    function prepareTransactionData(TxRecord memory record) private pure returns (bytes memory) {
        if (record.params.executionType == ExecutionType.STANDARD) {
            StandardExecutionOptions memory options = abi.decode(record.params.executionOptions, (StandardExecutionOptions));
            return abi.encodePacked(options.functionSelector, options.params);
        } else if (record.params.executionType == ExecutionType.RAW) {
            RawExecutionOptions memory options = abi.decode(record.params.executionOptions, (RawExecutionOptions));
            return options.rawTxData;
        } else {
            revert("Invalid execution type");
        }
    }

    /**
     * @dev Adds a role to a specified address.
     * @param self The SecureOperationState to modify.
     * @param role The role to add.
     * @param roleAddress The address to assign the role.
     */
    function addRole(SecureOperationState storage self, bytes32 role, address roleAddress) public {
        require(roleAddress != address(0), "Cannot set role to zero address");
        self.roles[role] = roleAddress;
    }

    /**
     * @dev Removes a role from a specified address.
     * @param self The SecureOperationState to modify.
     * @param role The role to remove.
     */
    function removeRole(SecureOperationState storage self, bytes32 role) public {
        require(role != OWNER_ROLE && role != BROADCASTER_ROLE, "Cannot remove owner or broadcaster role");
        delete self.roles[role];
    }

    /**
     * @dev Updates a role from an old address to a new address.
     * @param self The SecureOperationState to modify.
     * @param role The role to update.
     * @param newRoleAddress The new address to assign the role to.
     */
    function updateRole(SecureOperationState storage self, bytes32 role, address newRoleAddress) public {
        require(self.roles[role] != address(0), "Role does not exist");
        self.roles[role] = newRoleAddress;
    }

    /**
     * @dev Checks if a specified address has a given role.
     * @param self The SecureOperationState to check.
     * @param role The role to check.
     * @param roleAddress The address to check for the role.
     * @return True if the address has the role, false otherwise.
     */
    function hasRole(SecureOperationState storage self, bytes32 role, address roleAddress) public view returns (bool) {
        return self.roles[role] == roleAddress;
    }

    /**
     * @dev Checks if a role exists in the SecureOperationState
     * @param self The SecureOperationState to check
     * @param role The role to check for existence
     * @return bool True if the role exists (has an assigned address), false otherwise
     */
    function isRoleExist(SecureOperationState storage self, bytes32 role) public view returns (bool) {
        return self.roles[role] != address(0);
    }

    /**
     * @dev Checks if the caller has permission to execute a function.
     * @param self The SecureOperationState to check.
     * @param functionSelector The selector of the function to check permissions for.
     */
    function checkPermission(SecureOperationState storage self, bytes4 functionSelector) public view {
        bool hasPermission = checkPermissionPermissive(self,functionSelector);
        require(hasPermission, "Caller does not have permission to execute this function");
    }

    function checkPermissionPermissive(SecureOperationState storage self, bytes4 functionSelector) public view returns (bool) {
        bytes32[] memory allowedRoles = self.allowedRolesForFunction[functionSelector];
        bool hasPermission = false;
        for (uint i = 0; i < allowedRoles.length; i++) {
            if (hasRole(self, allowedRoles[i], msg.sender)) {
                hasPermission = true;
                break;
            }
        }
        return hasPermission;
    }

    /**
     * @dev Gets the current nonce for the owner.
     * @param self The SecureOperationState to check.
     * @return The current nonce.
     */
    function getNonce(SecureOperationState storage self) public view returns (uint256) {
        return self.metaTxNonce;
    }

    /**
     * @dev Gets the next transaction ID.
     * @param self The SecureOperationState to check.
     * @return The next transaction ID.
     */
    function getCurrentTxId(SecureOperationState storage self) public view returns (uint256) {
        return self.txCounter;
    }

    /**
     * @dev Gets the next transaction ID.
     * @param self The SecureOperationState to check.
     * @return The next transaction ID.
     */
    function getNextTxId(SecureOperationState storage self) public view returns (uint256) {
        return self.txCounter + 1;
    }

    /**
     * @dev Increments the transaction counter to set the next transaction ID.
     * @param self The SecureOperationState to modify.
     */
    function setNextTxId(SecureOperationState storage self) public {
        self.txCounter++;
    }

    /**
     * @dev Verifies the signature of a meta-transaction with detailed error reporting
     * @param self The SecureOperationState to check against
     * @param metaTx The meta-transaction containing the signature to verify
     * @return True if the signature is valid, false otherwise
     */
    function verifySignature(
        SecureOperationState storage self,
        MetaTransaction memory metaTx
    ) public view returns (bool) {
        // Basic validation
        require(metaTx.signature.length == 65, "Invalid signature length");
        require(metaTx.txRecord.status == TxStatus.PENDING, "Transaction not in pending state");

        // Transaction parameters validation
        require(metaTx.txRecord.params.target != address(0), "Invalid target address");
        require(metaTx.txRecord.params.requester != address(0), "Invalid requester address");
        require(isOperationTypeSupported(self, metaTx.txRecord.params.operationType), "Operation type not supported");

        // Meta-transaction parameters validation
        require(metaTx.params.chainId == block.chainid, "Chain ID mismatch");
        require(metaTx.params.handlerContract == msg.sender, "Handler contract mismatch");
        require(metaTx.params.signer != address(0), "Invalid signer address");
        require(block.timestamp <= metaTx.params.deadline, "Meta-transaction expired");

        // Gas price validation (if applicable)
        if (metaTx.params.maxGasPrice > 0) {
            require(block.basefee <= metaTx.params.maxGasPrice, "Current gas price exceeds maximum");
        }

        // Check against stored pending nonce instead of current nonce
         require(metaTx.params.nonce == getNonce(self), "Invalid nonce");

        // Signature verification
        bytes32 messageHash = generateMessageHash(metaTx);
        address recoveredSigner = recoverSigner(messageHash, metaTx.signature);
        require(recoveredSigner == metaTx.params.signer, "Invalid signature");

        // Authorization check
        bool isAuthorized = metaTx.params.signer == getOwner(self) ||
                           isAuthorizedSigner(self, metaTx.params.signer);
        require(isAuthorized, "Signer not authorized");

        return true;
    }

    /**
     * @dev Generates a message hash for the specified meta-transaction following EIP-712
     * @param metaTx The meta-transaction to generate the hash for
     * @return The generated message hash
     */
    function generateMessageHash(MetaTransaction memory metaTx) public view returns (bytes32) {
        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_SEPARATOR_TYPE_HASH,
            keccak256("MultiPhaseSecureOperation"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));

        bytes32 structHash = keccak256(abi.encode(
            TYPE_HASH,
            keccak256(abi.encode(
                metaTx.txRecord.txId,
                metaTx.txRecord.params.requester,
                metaTx.txRecord.params.target,
                metaTx.txRecord.params.value,
                metaTx.txRecord.params.gasLimit,
                metaTx.txRecord.params.operationType,
                uint8(metaTx.txRecord.params.executionType),
                keccak256(metaTx.txRecord.params.executionOptions)
            )),
            metaTx.params.chainId,
            metaTx.params.nonce,
            metaTx.params.handlerContract,
            metaTx.params.handlerSelector,
            metaTx.params.deadline,
            metaTx.params.maxGasPrice
        ));

        return keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));
    }

    /**
     * @dev Recovers the signer address from a message hash and signature.
     * @param messageHash The hash of the message that was signed.
     * @param signature The signature to recover the address from.
     * @return The address of the signer.
     */
    function recoverSigner(bytes32 messageHash, bytes memory signature) public pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        // More efficient assembly block with better memory safety
        assembly {
            // First 32 bytes stores the length of the signature
            // add(signature, 32) = pointer of sig + 32
            // effectively, skips first 32 bytes of signature
            r := mload(add(signature, 0x20))
            // add(signature, 64) = pointer of sig + 64
            // effectively, skips first 64 bytes of signature
            s := mload(add(signature, 0x40))
            // add(signature, 96) = pointer of sig + 96
            // effectively, skips first 96 bytes of signature
            // byte(0, mload(add(signature, 96))) = first byte of the next 32 bytes
            v := byte(0, mload(add(signature, 0x60)))
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Invalid s value");
        require(v == 27 || v == 28, "Invalid v value");

        address signer = ecrecover(ECDSA.toEthSignedMessageHash(messageHash), v, r, s);
        require(signer != address(0), "ECDSA: invalid signature");

        return signer;
    }

    /**
     * @dev Updates the time lock period for the SecureOperationState.
     * @param self The SecureOperationState to modify.
     * @param _newTimeLockPeriodInMinutes The new time lock period in minutes.
     */
    function updateTimeLockPeriod(SecureOperationState storage self, uint256 _newTimeLockPeriodInMinutes) public {
        require(_newTimeLockPeriodInMinutes > 0, "Time lock period must be greater than zero");
        self.timeLockPeriodInMinutes = _newTimeLockPeriodInMinutes;
    }

    /**
     * @dev Adds an authorized signer
     * @param self The SecureOperationState to modify.
     * @param signer The address to authorize as a signer.
     */
    function addAuthorizedSigner(SecureOperationState storage self, address signer) public {
        require(signer != address(0), "Cannot authorize zero address");
        require(signer != getOwner(self), "Cannot delegate to owner");
        require(!isAuthorizedSigner(self, signer), "Wallet already authorized");
        self.authorizedSigners[signer] = true;
    }

    /**
     * @dev Removes an authorized signer
     * @param self The SecureOperationState to modify.
     * @param signer The address to remove from authorized signers.
     */
    function removeAuthorizedSigner(SecureOperationState storage self, address signer) public {
        require(isAuthorizedSigner(self, signer), "Wallet not authorized");
        delete self.authorizedSigners[signer];
    }

    /**
     * @dev Checks if an address is an authorized signer
     * @param self The SecureOperationState to check.
     * @param signer The address to check.
     * @return bool True if the address is an authorized signer.
     */
    function isAuthorizedSigner(SecureOperationState storage self, address signer) public view returns (bool) {
        return self.authorizedSigners[signer];
    }

    /**
     * @dev Executes the payment associated with a meta-transaction.
     * @param self The SecureOperationState to modify.
     * @param metaTx The meta-transaction containing the payment details.
     * @notice This function verifies the signature of the meta-transaction and transfers
     *         the specified native tokens and/or ERC20 tokens to the recipient.
     */
    function executePayment(
        SecureOperationState storage self,
        MetaTransaction memory metaTx
    ) public {
        require(verifySignature(self, metaTx), "Invalid signature");

        PaymentDetails memory payment = metaTx.txRecord.payment;
        if (payment.nativeTokenAmount > 0) {
            require(address(this).balance >= payment.nativeTokenAmount, "Insufficient native token balance");
            (bool success, ) = payment.recipient.call{value: payment.nativeTokenAmount}("");
            require(success, "Native token transfer failed");
        }

        if (payment.erc20TokenAmount > 0) {
            require(payment.erc20TokenAddress != address(0), "Invalid token address");
            IERC20 erc20Token = IERC20(payment.erc20TokenAddress);
            require(erc20Token.balanceOf(address(this)) >= payment.erc20TokenAmount, "Insufficient token balance");

            bool success = erc20Token.transfer(payment.recipient, payment.erc20TokenAmount);
            require(success, "ERC20 token transfer failed");
        }

        self.txRecords[metaTx.txRecord.txId].payment = payment;
    }

    /**
     * @dev Creates StandardExecutionOptions with proper encoding
     * @param functionSelector The function selector to call
     * @param params The encoded parameters for the function
     * @return Encoded execution options ready for use in a transaction
     */
    function createStandardExecutionOptions(
        bytes4 functionSelector,
        bytes memory params
    ) public pure returns (bytes memory) {
        StandardExecutionOptions memory options = StandardExecutionOptions({
            functionSelector: functionSelector,
            params: params
        });
        return abi.encode(options);
    }

    /**
     * @dev Creates RawExecutionOptions with proper encoding
     * @param rawTxData The raw transaction data
     * @return Encoded execution options ready for use in a transaction
     */
    function createRawExecutionOptions(
        bytes memory rawTxData
    ) public pure returns (bytes memory) {
        RawExecutionOptions memory options = RawExecutionOptions({
            rawTxData: rawTxData
        });
        return abi.encode(options);
    }

    /**
    * @dev Registers a new operation type with a human-readable name
    * @param self The SecureOperationState to modify
    * @param readableType The operation type with its human-readable name
    */
    function addOperationType(
        SecureOperationState storage self,
        ReadableOperationType memory readableType
    ) public {
        require(!self.supportedOperationTypes[readableType.operationType], "Operation type already exists");
        self.supportedOperationTypes[readableType.operationType] = true;
        self.operationTypeNames[readableType.operationType] = readableType.name;
        self.supportedOperationTypesList.push(readableType.operationType);
    }

    /**
     * @dev Removes a supported operation type
     * @param self The SecureOperationState to modify
     * @param operationType The operation type to remove (as bytes32)
     */
    function removeOperationType(SecureOperationState storage self, bytes32 operationType) public {
        require(self.supportedOperationTypes[operationType], "Operation type does not exist");

        // Remove from mapping
        delete self.supportedOperationTypes[operationType];
        delete self.operationTypeNames[operationType];

        // Remove from array by finding and replacing with last element
        for (uint i = 0; i < self.supportedOperationTypesList.length; i++) {
            if (self.supportedOperationTypesList[i] == operationType) {
                // If not the last element, replace with the last element
                if (i != self.supportedOperationTypesList.length - 1) {
                    self.supportedOperationTypesList[i] = self.supportedOperationTypesList[
                        self.supportedOperationTypesList.length - 1
                    ];
                }
                // Remove the last element
                self.supportedOperationTypesList.pop();
                break;
            }
        }
    }

    /**
     * @dev Checks if an operation type is supported
     * @param self The SecureOperationState to check
     * @param operationType The operation type to check
     * @return bool True if the operation type is supported
     */
    function isOperationTypeSupported(SecureOperationState storage self, bytes32 operationType) public view returns (bool) {
        return self.supportedOperationTypes[operationType];
    }

    /**
     * @dev Gets all supported operation types with their human-readable names
     * @param self The SecureOperationState to check
     * @return Array of ReadableOperationType containing operation type hashes and their names
     */
    function getSupportedOperationTypes(
        SecureOperationState storage self
    ) public view returns (ReadableOperationType[] memory) {
        bytes32[] memory operationTypes = self.supportedOperationTypesList;
        ReadableOperationType[] memory readableTypes = new ReadableOperationType[](operationTypes.length);

        for (uint i = 0; i < operationTypes.length; i++) {
            readableTypes[i] = ReadableOperationType({
                operationType: operationTypes[i],
                name: self.operationTypeNames[operationTypes[i]]
            });
        }

        return readableTypes;
    }

    /**
     * @dev Creates a meta-transaction for a new operation
     */
    function generateUnsignedForNewMetaTx(
        SecureOperationState storage self,
        TxParams memory txParams,
        MetaTxParams memory metaTxParams
    ) public view returns (MetaTransaction memory) {
        require(isOperationTypeSupported(self, txParams.operationType), "Operation type not supported");
        require(txParams.target != address(0), "Invalid target address");

        TxRecord memory txRecord = createNewTxRecord(
            self,
            txParams.requester,
            txParams.target,
            txParams.value,
            txParams.gasLimit,
            txParams.operationType,
            txParams.executionType,
            txParams.executionOptions
        );

         MetaTransaction memory res = generateMetaTransaction(self, txRecord, metaTxParams);
         return res;
    }

    /**
     * @dev Creates a meta-transaction for an existing transaction
     */
    function generateUnsignedForExistingMetaTx(
        SecureOperationState storage self,
        uint256 txId,
        MetaTxParams memory metaTxParams
    ) public view returns (MetaTransaction memory) {
        TxRecord memory txRecord = getTxRecord(self, txId);
        require(txRecord.txId == txId, "Transaction not found");

        return generateMetaTransaction(self, txRecord, metaTxParams);
    }

    /**
     * @notice Creates a meta-transaction structure with default parameters
     * @dev Initializes a MetaTransaction with transaction record data and empty signature fields.
     *      The caller is responsible for filling in the following fields:
     *      - handlerContract: The contract that will handle the meta-transaction
     *      - handlerSelector: The function selector for the handler
     *      - deadline: The timestamp after which the meta-transaction expires
     *      - maxGasPrice: The maximum gas price allowed for execution
     *      - signer: The address that will sign the meta-transaction
     * @param self The SecureOperationState to reference for nonce
     * @param txRecord The transaction record to include in the meta-transaction
     * @param metaTxParams The meta-transaction parameters to include in the meta-transaction
     * @return MetaTransaction A new meta-transaction structure with default values
     */
    function generateMetaTransaction(
        SecureOperationState storage self,
        TxRecord memory txRecord,
        MetaTxParams memory metaTxParams
    ) private view returns (MetaTransaction memory) {
        require(metaTxParams.chainId == block.chainid, "Chain ID mismatch");
        require(metaTxParams.nonce == getNonce(self), "Invalid nonce");
        require(metaTxParams.handlerContract != address(0), "Invalid handler contract");
        require(metaTxParams.handlerSelector != bytes4(0), "Invalid handler selector");
        require(metaTxParams.deadline > block.timestamp, "Deadline must be in the future");
        require(metaTxParams.signer != address(0), "Invalid signer address");

        MetaTransaction memory metaTx = MetaTransaction({
            txRecord: txRecord,
            params: metaTxParams,
            message: bytes32(0),
            signature: new bytes(0),
            data: prepareTransactionData(txRecord)
        });

        // Generate the message hash for ready to sign meta-transaction
        bytes32 msgHash = generateMessageHash(metaTx);
        metaTx.message = msgHash;

        return metaTx;
    }

    /**
     * @dev Adds a role to the allowed roles for a specific function.
     * @param self The SecureOperationState to modify.
     * @param functionSelector The selector of the function to add role for.
     * @param role The role to add to the allowed roles.
     */
    function addRoleForFunction(SecureOperationState storage self, bytes4 functionSelector, bytes32 role) public {
        bytes32[] storage currentRoles = self.allowedRolesForFunction[functionSelector];
        // Check if role already exists
        for (uint i = 0; i < currentRoles.length; i++) {
            require(currentRoles[i] != role, "Role already exists for function");
        }
        currentRoles.push(role);
    }

    /**
     * @dev Removes a role from the allowed roles for a specific function.
     * @param self The SecureOperationState to modify.
     * @param functionSelector The selector of the function to remove role from.
     * @param role The role to remove from the allowed roles.
     */
    function removeRoleForFunction(SecureOperationState storage self, bytes4 functionSelector, bytes32 role) public {
        bytes32[] storage currentRoles = self.allowedRolesForFunction[functionSelector];
        bool found = false;

        // Find and remove the role by shifting elements
        for (uint i = 0; i < currentRoles.length; i++) {
            if (found) {
                currentRoles[i-1] = currentRoles[i];
            } else if (currentRoles[i] == role) {
                found = true;
            }
        }

        require(found, "Role not found for function");

        if (currentRoles.length > 0) {
            currentRoles.pop();
        }
    }

    /**
     * @dev Gets all allowed roles for a specific function.
     * @param self The SecureOperationState to check.
     * @param functionSelector The selector of the function to get roles for.
     * @return Array of allowed roles for the function.
     */
    function getAllowedRolesForFunction(SecureOperationState storage self, bytes4 functionSelector) public view returns (bytes32[] memory) {
        return self.allowedRolesForFunction[functionSelector];
    }

    /**
     * @notice Creates a new transaction record with basic fields populated
     * @dev Initializes a TxRecord struct with the provided parameters and default values
     * @param self The SecureOperationState to reference for txId and timelock
     * @param requester The address initiating the transaction
     * @param target The contract address that will receive the transaction
     * @param value The amount of native tokens to send with the transaction
     * @param gasLimit The maximum gas allowed for the transaction
     * @param operationType The type of operation being performed
     * @param executionType The method of execution (STANDARD or RAW)
     * @param executionOptions The encoded parameters for the execution
     * @return TxRecord A new transaction record with populated fields
     */
    function createNewTxRecord(
        SecureOperationState storage self,
        address requester,
        address target,
        uint256 value,
        uint256 gasLimit,
        bytes32 operationType,
        ExecutionType executionType,
        bytes memory executionOptions
    ) private view returns (TxRecord memory) {
        return TxRecord({
            txId: getNextTxId(self),
            releaseTime: block.timestamp + (self.timeLockPeriodInMinutes * 1 minutes),
            status: TxStatus.PENDING,
            params: TxParams({
                requester: requester,
                target: target,
                value: value,
                gasLimit: gasLimit,
                operationType: operationType,
                executionType: executionType,
                executionOptions: executionOptions
            }),
            result: new bytes(0),
            payment: PaymentDetails({
                recipient: address(0),
                nativeTokenAmount: 0,
                erc20TokenAddress: address(0),
                erc20TokenAmount: 0
            })
        });
    }

    /**
     * @notice Creates meta-transaction parameters with specified values
     * @dev Helper function to create properly formatted MetaTxParams
     * @param handlerContract The contract that will handle the meta-transaction
     * @param handlerSelector The function selector for the handler
     * @param deadline The timestamp after which the meta-transaction expires
     * @param maxGasPrice The maximum gas price allowed for execution
     * @param signer The address that will sign the meta-transaction
     * @return MetaTxParams The formatted meta-transaction parameters
     */
    function createMetaTxParams(
        SecureOperationState storage self,
        address handlerContract,
        bytes4 handlerSelector,
        uint256 deadline,
        uint256 maxGasPrice,
        address signer
    ) public view returns (MetaTxParams memory) {
        require(handlerContract != address(0), "Invalid handler contract");
        require(handlerSelector != bytes4(0), "Invalid handler selector");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(signer != address(0), "Invalid signer address");
        return MetaTxParams({
            chainId: block.chainid,
            nonce: getNonce(self),
            handlerContract: handlerContract,
            handlerSelector: handlerSelector,
            deadline:  deadline,
            maxGasPrice: maxGasPrice,
            signer: signer
        });
    }
}
