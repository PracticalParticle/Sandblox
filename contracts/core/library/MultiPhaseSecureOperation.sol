// SPDX-License-Identifier:
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    struct TxRecord {
        uint256 txId;
        uint256 releaseTime;
        TxStatus status;
        address requester;
        address target;
        bytes32 operationType;
        ExecutionType executionType;
        bytes executionOptions; // ABI encoded StandardExecutionOptions or RawExecutionOptions
        uint256 value;
        uint256 gasLimit;
        bytes result;
        PaymentDetails payment;
    }

    struct MetaTransaction {
        TxRecord txRecord;
        uint256 chainId;
        address handlerContract;
        bytes4 handlerSelector;
        uint256 nonce;
        uint256 deadline;
        uint256 maxGasPrice;
        // uint256 maxBasePrice; // optional for evm with EIP1559 support (can add a function to check if supported)
        address signer;
        bytes signature;
        bytes data;
    }

    struct PaymentDetails {
        address recipient;
        uint256 nativeTokenAmount;
        address erc20TokenAddress;
        uint256 erc20TokenAmount;
    }

    struct SecureOperationState {
        mapping(uint256 => TxRecord) txRecords;
        mapping(bytes32 => address) roles;
        mapping(bytes32 => bytes32[]) allowedRolesForFunction;
        mapping(address => bool) authorizedSigners;
        mapping(bytes32 => bool) supportedOperationTypes;
        uint256 txCounter;
        uint256 ownerNonce;
        uint256 timeLockPeriodInDays;
    }

    bytes32 constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 constant BROADCASTER_ROLE = keccak256("BROADCASTER_ROLE");
    bytes32 constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");

    bytes32 private constant TYPE_HASH = keccak256(
        "MetaTransaction(TxRecord txRecord,uint256 chainId,address handlerContract,bytes4 handlerSelector,uint256 nonce,uint256 deadline,uint256 maxGasPrice)TxRecord(uint256 txId,address requester,address target,bytes32 operationType,uint8 executionType,bytes executionOptions,uint256 value,uint256 gasLimit)"
    );
    
    bytes32 private constant DOMAIN_SEPARATOR_TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    event RequestedTx(uint256 indexed txId, uint256 releaseTime, address target, ExecutionType executionType, bytes executionOptions);
    event TxApproved(uint256 indexed txId);
    event TxCancelled(uint256 indexed txId);
    event TxExecuted(uint256 indexed txId, bool success, bytes result);

    /**
     * @dev Initializes the SecureOperationState with the specified time lock period and roles.
     * @param self The SecureOperationState to initialize.
     * @param _timeLockPeriodInDays The time lock period in days.
     * @param _owner The address of the owner.
     * @param _broadcaster The address of the broadcaster.
     */
    function initialize(
        SecureOperationState storage self, 
        uint256 _timeLockPeriodInDays, 
        address _owner, 
        address _broadcaster,
        bytes32[] memory initialOperationTypes
    ) public {
        require(_owner != address(0), "Invalid owner address");
        require(_broadcaster != address(0), "Invalid broadcaster address");
        require(_timeLockPeriodInDays > 0, "Invalid time lock period");

        self.timeLockPeriodInDays = _timeLockPeriodInDays;
        self.txCounter = 0;
        
        addRole(self, OWNER_ROLE, _owner);
        addRole(self, BROADCASTER_ROLE, _broadcaster);
        
        bytes32[] memory ownerFunctions = new bytes32[](3);
        ownerFunctions[0] = keccak256("txRequest");
        ownerFunctions[1] = keccak256("txDelayedApproval");
        ownerFunctions[2] = keccak256("txCancellation");
        
        for (uint i = 0; i < ownerFunctions.length; i++) {
            bytes32[] memory roles = new bytes32[](1);
            roles[0] = OWNER_ROLE;
            setAllowedRolesForFunction(self, ownerFunctions[i], roles);
        }
        
        bytes32[] memory broadcasterFunctions = new bytes32[](3);
        broadcasterFunctions[0] = keccak256("txApprovalWithMetaTx");
        broadcasterFunctions[1] = keccak256("requestAndApprove");
        broadcasterFunctions[2] = keccak256("txCancellationWithMetaTx");
        
        for (uint i = 0; i < broadcasterFunctions.length; i++) {
            bytes32[] memory roles = new bytes32[](1);
            roles[0] = BROADCASTER_ROLE;
            setAllowedRolesForFunction(self, broadcasterFunctions[i], roles);
        }

        // Add initial operation types
        for (uint i = 0; i < initialOperationTypes.length; i++) {
            addOperationType(self, initialOperationTypes[i]);
        }
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
     * @dev Adds a recovery role to the specified address.
     * @param self The SecureOperationState to modify.
     * @param recoveryAddress The address to assign the recovery role.
     */
    function addRecoveryRole(SecureOperationState storage self, address recoveryAddress) public {
        addRole(self, RECOVERY_ROLE, recoveryAddress);

        bytes32[] memory recoveryFunctions = new bytes32[](3);
        recoveryFunctions[0] = keccak256("txRequest");
        recoveryFunctions[1] = keccak256("txDelayedApproval");
        recoveryFunctions[2] = keccak256("txCancellation");

        for (uint i = 0; i < recoveryFunctions.length; i++) {
            bytes32[] memory currentAllowedRoles = self.allowedRolesForFunction[recoveryFunctions[i]];
            bytes32[] memory newAllowedRoles = new bytes32[](currentAllowedRoles.length + 1);
            
            for (uint j = 0; j < currentAllowedRoles.length; j++) {
                newAllowedRoles[j] = currentAllowedRoles[j];
            }
            newAllowedRoles[currentAllowedRoles.length] = RECOVERY_ROLE;
            
            setAllowedRolesForFunction(self, recoveryFunctions[i], newAllowedRoles);
        }
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
     * @dev Creates a new transaction record with basic fields populated.
     * Parameters are ordered to match TxRecord struct:
     * struct TxRecord {
     *     uint256 txId;
     *     uint256 releaseTime;
     *     TxStatus status;
     *     address requester;
     *     address target;
     *     bytes32 operationType;
     *     ExecutionType executionType;
     *     bytes executionOptions;
     *     uint256 value;
     *     uint256 gasLimit;
     *     bytes result;
     * }
     */
    function createNewTxRecord(
        SecureOperationState storage self,
        address _requester,
        address _target,
        bytes32 _operationType,
        ExecutionType _executionType,
        bytes memory _executionOptions,
        uint256 _value,
        uint256 _gasLimit
    ) public view returns (TxRecord memory) {        
        return TxRecord({
            txId: getNextTxId(self),
            releaseTime: block.timestamp + (self.timeLockPeriodInDays * 1 days),
            status: TxStatus.PENDING,
            requester: _requester,
            target: _target,
            operationType: _operationType,
            executionType: _executionType,
            executionOptions: _executionOptions,
            value: _value,
            gasLimit: _gasLimit,
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
     * @dev Requests a transaction with the specified parameters.
     * @param self The SecureOperationState to modify.
     * @param _target The target contract address for the transaction.
     * @param _executionType The type of execution (STANDARD or RAW).
     * @param _executionOptions The execution options for the transaction.
     * @return The created TxRecord.
     */
    function txRequest(
        SecureOperationState storage self,
        address _requester,
        address _target,
        bytes32 _operationType,
        ExecutionType _executionType,
        bytes memory _executionOptions,
        uint256 _value,
        uint256 _gasLimit
    ) public returns (TxRecord memory) {
        checkPermission(self, keccak256("txRequest"));
        require(_target != address(0), "Invalid target address");
        require(isOperationTypeSupported(self, _operationType), "Operation type not supported");

        TxRecord memory txRequestRecord = createNewTxRecord(
            self,
            _requester,
            _target,
            _operationType,
            _executionType,
            _executionOptions,
            _value,
            _gasLimit
        );
    
        self.txRecords[txRequestRecord.txId] = txRequestRecord;
        setNextTxId(self);
        emit RequestedTx(txRequestRecord.txId, txRequestRecord.releaseTime, txRequestRecord.target, txRequestRecord.executionType, txRequestRecord.executionOptions);
        
        return txRequestRecord;
    }

    /**
     * @dev Approves a pending transaction after the release time.
     * @param self The SecureOperationState to modify.
     * @param txId The ID of the transaction to approve.
     * @return The updated TxRecord.
     */
    function txDelayedApproval(SecureOperationState storage self, uint256 txId) public returns (TxRecord memory) {
        checkPermission(self, keccak256("txDelayedApproval"));
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only approve pending requests");
        require(block.timestamp >= self.txRecords[txId].releaseTime, "Current time is before release time");
        
        (bool success, bytes memory result) = executeTransaction(self.txRecords[txId]);
        
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
        checkPermission(self, keccak256("txCancellation"));
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
        checkPermission(self, keccak256("txCancellationWithMetaTx"));
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only cancel pending requests");  
        require(verifySignature(self, metaTx), "Invalid signature");       
        self.ownerNonce++;
        
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
        checkPermission(self, keccak256("txApprovalWithMetaTx"));
        require(self.txRecords[txId].status == TxStatus.PENDING, "Can only approve pending requests");
        require(verifySignature(self, metaTx), "Invalid signature");
        self.ownerNonce++;
        
        (bool success, bytes memory result) = executeTransaction(self.txRecords[txId]);
        
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
        checkPermission(self, keccak256("requestAndApprove"));
        
        TxRecord memory txRecord = txRequest(
            self,
            metaTx.txRecord.requester,
            metaTx.txRecord.target,
            metaTx.txRecord.operationType,
            metaTx.txRecord.executionType,
            metaTx.txRecord.executionOptions,
            metaTx.txRecord.value,
            metaTx.txRecord.gasLimit
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
        
        (bool success, bytes memory result) = record.target.call{value: record.value, gas: record.gasLimit}(
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
        if (record.executionType == ExecutionType.STANDARD) {
            StandardExecutionOptions memory options = abi.decode(record.executionOptions, (StandardExecutionOptions));
            return abi.encodePacked(options.functionSelector, options.params);
        } else if (record.executionType == ExecutionType.RAW) {
            RawExecutionOptions memory options = abi.decode(record.executionOptions, (RawExecutionOptions));
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
     * @dev Sets allowed roles for a specific function.
     * @param self The SecureOperationState to modify.
     * @param functionName The name of the function to set roles for.
     * @param allowedRoles The roles allowed to execute the function.
     */
    function setAllowedRolesForFunction(SecureOperationState storage self, bytes32 functionName, bytes32[] memory allowedRoles) public {
        self.allowedRolesForFunction[functionName] = allowedRoles;
    }

    /**
     * @dev Checks if the caller has permission to execute a function.
     * @param self The SecureOperationState to check.
     * @param functionName The name of the function to check permissions for.
     */
    function checkPermission(SecureOperationState storage self, bytes32 functionName) public view {
        bytes32[] memory allowedRoles = self.allowedRolesForFunction[functionName];
        bool hasPermission = false;
        for (uint i = 0; i < allowedRoles.length; i++) {
            if (hasRole(self, allowedRoles[i], msg.sender)) {
                hasPermission = true;
                break;
            }
        }
        require(hasPermission, "Caller does not have permission to execute this function");
    }

    /**
     * @dev Gets the current nonce for the owner.
     * @param self The SecureOperationState to check.
     * @return The current nonce.
     */
    function getNonce(SecureOperationState storage self) public view returns (uint256) {
        return self.ownerNonce;
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
     * @dev Generates a meta-transaction for the specified transaction record.
     * @param self The SecureOperationState to check.
     * @param txRecord The TxRecord to generate the meta-transaction for.
     * @param deadline The deadline for the meta-transaction.
     * @param maxGasPrice The maximum gas price for the meta-transaction.
     * @param signer The address of the signer.
     * @return generated MetaTransaction.
     */
    function generateUnsignedMetaTransaction(
        SecureOperationState storage self,
        TxRecord memory txRecord,
        address handlerContract,
        bytes4 handlerSelector,
        uint256 deadline, 
        uint256 maxGasPrice,
        address signer
    ) public view returns (MetaTransaction memory) {
        return MetaTransaction({
            txRecord: txRecord,
            chainId: block.chainid,
            handlerContract: handlerContract,
            handlerSelector: handlerSelector,
            nonce: getNonce(self),
            deadline: deadline,
            maxGasPrice: maxGasPrice,
            signer: signer,
            signature: new bytes(0), // Initialize with empty bytes
            data: prepareTransactionData(txRecord)
        });
    }

    /**
     * @dev Generates a message hash for the specified meta-transaction following EIP-712.
     * @param metaTx The meta-transaction to generate the hash for.
     * @return The generated message hash.
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
                metaTx.txRecord.requester,
                metaTx.txRecord.target,
                metaTx.txRecord.operationType,
                uint8(metaTx.txRecord.executionType),
                keccak256(metaTx.txRecord.executionOptions),
                metaTx.txRecord.value,
                metaTx.txRecord.gasLimit

            )),
            metaTx.chainId,
            metaTx.handlerContract,
            metaTx.handlerSelector,
            metaTx.nonce,
            metaTx.deadline,
            metaTx.maxGasPrice
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

        address signer = ecrecover(messageHash, v, r, s);
        require(signer != address(0), "ECDSA: invalid signature");

        return signer;
    }

    /**
     * @dev Verifies the signature of a meta-transaction against the owner's address or authorized signers.
     * @param self The SecureOperationState to check against.
     * @param metaTx The meta-transaction containing the signature to verify.
     * @return True if the signature is valid, false otherwise.
     */
    function verifySignature(SecureOperationState storage self, MetaTransaction memory metaTx) public view returns (bool) {
        require(isOperationTypeSupported(self, metaTx.txRecord.operationType), "Operation type not supported");
        require(metaTx.signature.length == 65, "Invalid signature length");
        require(metaTx.chainId == block.chainid, "Chain ID mismatch");
        require(metaTx.handlerContract == msg.sender, "Handler contract mismatch");
        require(metaTx.nonce == getNonce(self), "Nonce mismatch");
        require(block.timestamp <= metaTx.deadline, "Meta-transaction expired");
        
        bytes32 messageHash = generateMessageHash(metaTx);
        address recoveredSigner = recoverSigner(messageHash, metaTx.signature);
        
        // Verify that recovered signer matches the specified signer
        require(recoveredSigner == metaTx.signer, "Signature mismatch");
        
        // Check if signer is owner or authorized signer
        return (metaTx.signer == getOwner(self) || isAuthorizedSigner(self, metaTx.signer));
    }

    /**
     * @dev Updates the time lock period for the SecureOperationState.
     * @param self The SecureOperationState to modify.
     * @param _newTimeLockPeriodInDays The new time lock period in days.
     */
    function updateTimeLockPeriod(SecureOperationState storage self, uint256 _newTimeLockPeriodInDays) public {
        require(_newTimeLockPeriodInDays > 0, "Time lock period must be greater than zero");
        self.timeLockPeriodInDays = _newTimeLockPeriodInDays;
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

    function executePayment(
        SecureOperationState storage self,
        PaymentDetails memory payment,
        MetaTransaction memory metaTx
    ) public {
        require(verifySignature(self, metaTx), "Invalid signature");
        
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
     * @dev Adds a new supported operation type
     * @param self The SecureOperationState to modify
     * @param operationType The operation type to add (as bytes32)
     */
    function addOperationType(SecureOperationState storage self, bytes32 operationType) public {
        require(!self.supportedOperationTypes[operationType], "Operation type already exists");
        self.supportedOperationTypes[operationType] = true;
    }

    /**
     * @dev Removes a supported operation type
     * @param self The SecureOperationState to modify
     * @param operationType The operation type to remove (as bytes32)
     */
    function removeOperationType(SecureOperationState storage self, bytes32 operationType) public {
        require(self.supportedOperationTypes[operationType], "Operation type does not exist");
        delete self.supportedOperationTypes[operationType];
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
}
