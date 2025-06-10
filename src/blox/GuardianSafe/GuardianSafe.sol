// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.8.2;

import "../../GuardianAccountAbstraction.sol";
// import "../../lib/MultiPhaseSecureOperation.sol";

interface ISafe {
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);
}

interface ITransactionGuard {
    enum Operation {
        Call,
        DelegateCall
    }

    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external;

    function checkAfterExecution(bytes32 hash, bool success) external;
}

/**
 * @title GuardianSafe
 * @dev A secure wrapper for Safe wallet functionality using GuardianAccountAbstraction security framework.
 * Implements time-locked operations and meta-transaction support for enhanced security.
 */
contract GuardianSafe is GuardianAccountAbstraction, ITransactionGuard {
    // Operation types
    bytes32 public constant EXEC_SAFE_TX = keccak256("EXEC_SAFE_TX");

    // Function selectors
    bytes4 private constant EXEC_SAFE_TX_SELECTOR = bytes4(keccak256("executeTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)"));
    
    // Meta-transaction function selectors
    bytes4 private constant APPROVE_TX_META_SELECTOR = bytes4(keccak256("approveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));
    bytes4 private constant CANCEL_TX_META_SELECTOR = bytes4(keccak256("cancelTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));
    bytes4 private constant REQUEST_AND_APPROVE_TX_META_SELECTOR = bytes4(keccak256("requestAndApproveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));

    // DelegateCall flag
    bool public delegatedCallEnabled = false;

    // Safe transaction structure
    struct SafeTx {
        address to;             // Destination address
        uint256 value;          // Ether value
        bytes data;             // Data payload
        uint8 operation;        // Operation type (0=Call, 1=DelegateCall)
        uint256 safeTxGas;      // Gas for Safe transaction
        uint256 baseGas;        // Gas costs for data
        uint256 gasPrice;       // Maximum gas price
        address gasToken;       // Token for gas payment (0 for ETH)
        address payable refundReceiver;  // Refund receiver address
        bytes signatures;       // Packed signature data
    }

    // Safe instance
    ISafe private immutable safe;

    // Events
    event TransactionRequested(SafeTx safeTx);
    event TransactionExecuted(bytes32 operationType, bytes executionData);
    event TransactionCancelled(uint256 txId);
    event DelegatedCallStatusChanged(bool enabled);

    // Meta-transaction parameters struct
    struct SafeMetaTxParams {
        uint256 deadline;
        uint256 maxGasPrice;
    }

    /**
     * @notice Constructor to initialize the GuardianSafe
     * @param _safe The Safe contract address
     * @param initialOwner The initial owner address
     * @param broadcaster The broadcaster address for meta-transactions
     * @param recovery The recovery address
     * @param timeLockPeriodInMinutes The timelock period for operations
     */
    constructor(
        address _safe,
        address initialOwner,
        address broadcaster,
        address recovery,
        uint256 timeLockPeriodInMinutes
    ) GuardianAccountAbstraction(
        initialOwner,
        broadcaster,
        recovery,
        timeLockPeriodInMinutes
    ) {
        _validateNotZeroAddress(_safe);
        safe = ISafe(_safe);

        // Initialize operation type
        MultiPhaseSecureOperation.addOperationType(_getSecureState(), MultiPhaseSecureOperation.ReadableOperationType({
            operationType: EXEC_SAFE_TX,
            name: "EXEC_SAFE_TX"
        }));

        // Add meta-transaction function selector permissions for broadcaster
        MultiPhaseSecureOperation.addRoleForFunction(_getSecureState(), APPROVE_TX_META_SELECTOR, MultiPhaseSecureOperation.BROADCASTER_ROLE);
        MultiPhaseSecureOperation.addRoleForFunction(_getSecureState(), CANCEL_TX_META_SELECTOR, MultiPhaseSecureOperation.BROADCASTER_ROLE);
        MultiPhaseSecureOperation.addRoleForFunction(_getSecureState(), REQUEST_AND_APPROVE_TX_META_SELECTOR, MultiPhaseSecureOperation.BROADCASTER_ROLE);
    }

    /**
     * @notice Gets the underlying Safe contract address
     * @return The address of the Safe contract
     */
    function getSafeAddress() external view returns (address) {
        return address(safe);
    }

    /**
     * @notice Enable or disable delegated calls
     * @param enabled True to enable delegated calls, false to disable
     */
    function setDelegatedCallEnabled(bool enabled) external onlyOwner {
        delegatedCallEnabled = enabled;
        emit DelegatedCallStatusChanged(enabled);
    }

    /**
     * @notice Request execution of a Safe transaction with time-lock security
     * @param safeTx The Safe transaction parameters
     */
    function requestTransaction(SafeTx calldata safeTx) 
        external 
        onlyOwner 
        returns (MultiPhaseSecureOperation.TxRecord memory) 
    {
        bytes memory executionOptions = createTransactionExecutionOptions(safeTx);

        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.txRequest(
            _getSecureState(),
            msg.sender,
            address(this),
            safeTx.value,
            safeTx.safeTxGas,
            EXEC_SAFE_TX,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions
        );

        addOperation(txRecord);
        
        emit TransactionRequested(safeTx);

        return txRecord;
    }

    /**
     * @notice Approve a pending transaction after timelock period
     * @param txId The transaction ID to approve
     */
    function approveTransactionAfterDelay(uint256 txId) external onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = MultiPhaseSecureOperation.txDelayedApproval(_getSecureState(), txId);
        _validateOperationType(updatedRecord.params.operationType, EXEC_SAFE_TX);

        finalizeOperation(updatedRecord);
        return updatedRecord;
    }

    /**
     * @notice Approve a pending transaction with meta transaction
     * @param metaTx Meta transaction data
     */
    function approveTransactionWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) 
        external 
        onlyBroadcaster 
        returns (MultiPhaseSecureOperation.TxRecord memory) 
    {
        MultiPhaseSecureOperation.checkPermission(_getSecureState(), APPROVE_TX_META_SELECTOR);
        _validateHandlerSelector(metaTx.params.handlerSelector, APPROVE_TX_META_SELECTOR);
        
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = MultiPhaseSecureOperation.txApprovalWithMetaTx(
            _getSecureState(),
            metaTx
        );
        _validateOperationType(updatedRecord.params.operationType, EXEC_SAFE_TX);

        finalizeOperation(updatedRecord);
        return updatedRecord;
    }

    /**
     * @notice Cancel a pending transaction
     * @param txId The transaction ID to cancel
     */
    function cancelTransaction(uint256 txId) external onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = MultiPhaseSecureOperation.txCancellation(_getSecureState(), txId);
        _validateOperationType(updatedRecord.params.operationType, EXEC_SAFE_TX);

        finalizeOperation(updatedRecord);
        emit TransactionCancelled(txId);
        return updatedRecord;
    }

    /**
     * @notice Cancel a pending transaction with meta transaction
     * @param metaTx Meta transaction data
     */
    function cancelTransactionWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) 
        external 
        onlyBroadcaster 
        returns (MultiPhaseSecureOperation.TxRecord memory) 
    {
        MultiPhaseSecureOperation.checkPermission(_getSecureState(), CANCEL_TX_META_SELECTOR);
        _validateHandlerSelector(metaTx.params.handlerSelector, CANCEL_TX_META_SELECTOR);
        
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = MultiPhaseSecureOperation.txCancellationWithMetaTx(
            _getSecureState(),
            metaTx
        );
        _validateOperationType(updatedRecord.params.operationType, EXEC_SAFE_TX);

        finalizeOperation(updatedRecord);
        emit TransactionCancelled(updatedRecord.txId);
        return updatedRecord;
    }

    /**
     * @notice Request and approve a Safe transaction in a single phase using meta-transaction
     * @param metaTx Meta transaction data
     * @return The transaction record
     */
    function requestAndApproveTransactionWithMetaTx(
        MultiPhaseSecureOperation.MetaTransaction memory metaTx
    ) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.checkPermission(_getSecureState(), REQUEST_AND_APPROVE_TX_META_SELECTOR);
        _validateHandlerSelector(metaTx.params.handlerSelector, REQUEST_AND_APPROVE_TX_META_SELECTOR);

        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.requestAndApprove(
            _getSecureState(),
            metaTx
        );
        _validateOperationType(txRecord.params.operationType, EXEC_SAFE_TX);

        addOperation(txRecord);
        finalizeOperation(txRecord);
        return txRecord;
    }

    /**
     * @notice Execute a Safe transaction through execTransaction
     * @param safeTx The Safe transaction parameters
     */
    function executeTransaction(SafeTx memory safeTx) external {
        _validateInternal();
        bool success = safe.execTransaction(
            safeTx.to,
            safeTx.value,
            safeTx.data,
            safeTx.operation,
            safeTx.safeTxGas,
            safeTx.baseGas,
            safeTx.gasPrice,
            safeTx.gasToken,
            safeTx.refundReceiver,
            safeTx.signatures
        );
        require(success, "Safe transaction execution failed");
    }

    /**
     * @dev Internal function to add an operation to history
     * @param txRecord The transaction record to add
     */
    function addOperation(MultiPhaseSecureOperation.TxRecord memory txRecord) internal override {
        super.addOperation(txRecord);
    }

    /**
     * @dev Internal function to finalize an operation
     * @param txRecord The transaction record to finalize
     */
    function finalizeOperation(MultiPhaseSecureOperation.TxRecord memory txRecord) internal override {
        super.finalizeOperation(txRecord);
        emit TransactionExecuted(txRecord.params.operationType, txRecord.params.executionOptions);
    }

    /**
     * @dev Returns whether the module supports a given interface
     * @param interfaceId The interface identifier
     * @return bool True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}

    /**
     * @notice Generate an unsigned meta-transaction for a new Safe transaction
     * @param safeTx The Safe transaction parameters
     * @param params Meta transaction parameters
     * @return The unsigned meta-transaction
     */
    function generateUnsignedSafeMetaTxForNew(
        SafeTx memory safeTx,
        SafeMetaTxParams memory params
    ) public view returns (MultiPhaseSecureOperation.MetaTransaction memory) {
        // Validate that operation is Call (0)
        require(safeTx.operation == 0, "Only Call operations are allowed in single-phase meta transactions");

        bytes memory executionOptions = createTransactionExecutionOptions(safeTx);

        // Create meta-transaction parameters
        MultiPhaseSecureOperation.MetaTxParams memory metaTxParams = createMetaTxParams(
            address(this),
            REQUEST_AND_APPROVE_TX_META_SELECTOR,
            params.deadline,
            params.maxGasPrice,
            owner()
        );

        // Generate the unsigned meta-transaction
        return generateUnsignedMetaTransactionForNew(
            owner(),
            address(this),
            safeTx.value,
            safeTx.safeTxGas,
            EXEC_SAFE_TX,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions,
            metaTxParams
        );
    }

    /**
     * @notice Generate an unsigned meta-transaction for an existing Safe transaction
     * @param txId The ID of the existing transaction
     * @param params Meta transaction parameters
     * @param isApproval Whether this is for approval (true) or cancellation (false)
     * @return The unsigned meta-transaction
     */
    function generateUnsignedSafeMetaTxForExisting(
        uint256 txId,
        SafeMetaTxParams memory params,
        bool isApproval
    ) public view returns (MultiPhaseSecureOperation.MetaTransaction memory) {
        // Create meta-transaction parameters with appropriate selector
        MultiPhaseSecureOperation.MetaTxParams memory metaTxParams = createMetaTxParams(
            address(this),
            isApproval ? APPROVE_TX_META_SELECTOR : CANCEL_TX_META_SELECTOR,
            params.deadline,
            params.maxGasPrice,
            owner()
        );

        // Generate the unsigned meta-transaction
        return generateUnsignedMetaTransactionForExisting(
            txId,
            metaTxParams
        );
    }

     /**
     * @notice Create execution options for a Safe transaction
     * @param safeTx The Safe transaction parameters
     * @return The execution options bytes
     */
    function createTransactionExecutionOptions(
        SafeTx memory safeTx
    ) public view returns (bytes memory) {
        _validateNotZeroAddress(safeTx.to);

        bytes memory executionData = abi.encode(
            safeTx.to,
            safeTx.value,
            safeTx.data,
            safeTx.operation,
            safeTx.safeTxGas,
            safeTx.baseGas,
            safeTx.gasPrice,
            safeTx.gasToken,
            safeTx.refundReceiver,
            safeTx.signatures
        );

        return MultiPhaseSecureOperation.createStandardExecutionOptions(
            EXEC_SAFE_TX_SELECTOR,
            executionData
        );
    }

    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external override {
        _validateInternal();
        
        // Check if this is a delegated call and validate if needed
        if (operation == Operation.DelegateCall) {
            _validateDelegation();
        }
    }

    function checkAfterExecution(bytes32 hash, bool success) external override {
        // Empty implementation as per requirements
    }

    /**
     * @notice Validates if delegated calls are allowed
     * @dev Reverts if delegated calls are not enabled
     */
    function _validateDelegation() internal view {
        require(delegatedCallEnabled, "Delegated calls are not enabled");
    }
}
