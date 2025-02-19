// SPDX-License-Identifier:
pragma solidity ^0.8.0;

// OpenZeppelin imports
import "@openzeppelin/contracts/access/Ownable.sol";

// Contracts imports
import "../library/MultiPhaseSecureOperation.sol";

abstract contract SecureOwnable is Ownable {
    using MultiPhaseSecureOperation for MultiPhaseSecureOperation.SecureOperationState;

    // Define operation type constants
    bytes32 public constant OWNERSHIP_UPDATE = keccak256("OWNERSHIP_UPDATE");
    bytes32 public constant BROADCASTER_UPDATE = keccak256("BROADCASTER_UPDATE");
    bytes32 public constant RECOVERY_UPDATE = keccak256("RECOVERY_UPDATE");
    bytes32 public constant TIMELOCK_UPDATE = keccak256("TIMELOCK_UPDATE");

    uint256 private _timeLockPeriodInDays;
    address private _recoveryAddress;
    address private _broadcaster;  

    MultiPhaseSecureOperation.SecureOperationState private _secureState;
    mapping(uint256 => MultiPhaseSecureOperation.TxRecord) private _operationHistory;

    event OwnershipTransferRequest(address currentOwner, address newOwner);
    event OwnershipTransferCancelled(uint256 txId);
    event OwnershipTransferUpdated(address oldOwner, address newOwner);
    event BroadcasterUpdateRequest(address currentBroadcaster, address newBroadcaster);
    event BroadcasterUpdateCancelled(uint256 txId);
    event BroadcasterUpdated(address oldBroadcaster, address newBroadcaster);
    event RecoveryAddressUpdated(address oldRecovery, address newRecovery);
    event TimeLockPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);

    modifier onlyOwnerOrRecovery() {
        require(msg.sender == owner() || msg.sender == _recoveryAddress, "Restricted to owner or recovery");
        _;
    }
    
    modifier onlyRecovery() {
        require(msg.sender == _recoveryAddress, "Restricted to recovery owner");
        _;
    }

    modifier onlyBroadcaster() {
        require(msg.sender == _broadcaster, "Restricted to Broadcaster");
        _;
    }

    /**
     * @notice Constructor to initialize SecureOwnable state
     * @param initialOwner The initial owner address
     * @param recoveryAddr The recovery address
     * @param timeLockPeriodInDays The timelock period in days
     * @param broadcaster The broadcaster address
     */
    constructor(
        address initialOwner,
        address recoveryAddr,
        uint256 timeLockPeriodInDays,
        address broadcaster
    ) {       
        _timeLockPeriodInDays = timeLockPeriodInDays;
        _recoveryAddress = recoveryAddr;
        _broadcaster = broadcaster;
            
        // Initialize with operation types
        bytes32[] memory operationTypes = new bytes32[](4);
        operationTypes[0] = OWNERSHIP_UPDATE;
        operationTypes[1] = BROADCASTER_UPDATE;
        operationTypes[2] = RECOVERY_UPDATE;
        operationTypes[3] = TIMELOCK_UPDATE;

        _secureState.initialize(timeLockPeriodInDays, initialOwner, broadcaster, operationTypes);
        _secureState.addRecoveryRole(recoveryAddr);
        _transferOwnership(initialOwner);
    }

    // Ownership Management
    /**
     * @dev Requests a transfer of ownership
     * @return The transaction record
     */
    function transferOwnershipRequest() public onlyRecovery returns (MultiPhaseSecureOperation.TxRecord memory) {
        bytes memory executionOptions = abi.encode(MultiPhaseSecureOperation.StandardExecutionOptions({
            functionSelector: bytes4(keccak256("_transferOwnership(address)")),
            params: abi.encode(_recoveryAddress)
        }));

        MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.txRequest(
            msg.sender,
            address(this),
            OWNERSHIP_UPDATE,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions,
            0,
            0
        );

        addOperation(txRecord);
        emit OwnershipTransferRequest(owner(), _recoveryAddress);
        return txRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param txId The transaction ID
     * @return The updated transaction record
     */
    function transferOwnershipDelayedApproval(uint256 txId) public onlyOwnerOrRecovery returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txDelayedApproval(txId);
        require(updatedRecord.operationType == OWNERSHIP_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        return updatedRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param metaTx The meta-transaction
     * @return The updated transaction record
     */
    function transferOwnershipApprovalWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txApprovalWithMetaTx(metaTx);
        require(updatedRecord.operationType == OWNERSHIP_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        return updatedRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param txId The transaction ID
     * @return The updated transaction record
     */
    function transferOwnershipCancellation(uint256 txId) public onlyRecovery returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.getTxRecord(txId);
        require(block.timestamp >= txRecord.releaseTime - (_timeLockPeriodInDays * 1 days) + 1 hours, "Cannot cancel within first hour");
        
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txCancellation(txId);
        require(updatedRecord.operationType == OWNERSHIP_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        emit OwnershipTransferCancelled(txId);
        return updatedRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param metaTx The meta-transaction
     * @return The updated transaction record
     */
    function transferOwnershipCancellationWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txCancellationWithMetaTx(metaTx);
        require(updatedRecord.operationType == OWNERSHIP_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        emit OwnershipTransferCancelled(updatedRecord.txId);
        return updatedRecord;
    }

    // Broadcaster Management
    /**
     * @dev Updates the broadcaster address
     * @param newBroadcaster The new broadcaster address
     * @return The execution options
     */
    function updateBroadcasterRequest(address newBroadcaster) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        require(newBroadcaster != address(0), "Invalid broadcaster address");
        require(newBroadcaster != _broadcaster, "New broadcaster must be different");
        
        bytes memory executionOptions = abi.encode(MultiPhaseSecureOperation.StandardExecutionOptions({
            functionSelector: bytes4(keccak256("_updateBroadcaster(address)")),
            params: abi.encode(newBroadcaster)
        }));

        MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.txRequest(
            msg.sender,
            address(this),
            BROADCASTER_UPDATE,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions,
            0,
            0
        );

        addOperation(txRecord);
        emit BroadcasterUpdateRequest(_broadcaster, newBroadcaster);
        return txRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param txId The transaction ID
     * @return The updated transaction record
     */
    function updateBroadcasterDelayedApproval(uint256 txId) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txDelayedApproval(txId);
        require(updatedRecord.operationType == BROADCASTER_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        return updatedRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param metaTx The meta-transaction
     * @return The updated transaction record
     */
    function updateBroadcasterApprovalWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txApprovalWithMetaTx(metaTx);
        require(updatedRecord.operationType == BROADCASTER_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        return updatedRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param txId The transaction ID
     * @return The updated transaction record
     */
    function updateBroadcasterCancellation(uint256 txId) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.getTxRecord(txId);
        require(block.timestamp >= txRecord.releaseTime - (_timeLockPeriodInDays * 1 days) + 1 hours, "Cannot cancel within first hour");
        
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txCancellation(txId);
        require(updatedRecord.operationType == BROADCASTER_UPDATE, "Invalid operation type");
        finalizeOperation(updatedRecord);
        emit BroadcasterUpdateCancelled(txId);
        return updatedRecord;
    }

    // Recovery Management
    /**
     * @dev Updates the recovery address
     * @param newRecoveryAddress The new recovery address
     * @return The execution options
     */
    function updateRecoveryExecutionOptions(
        address newRecoveryAddress
    ) public view returns (bytes memory) {
        require(newRecoveryAddress != address(0), "Invalid recovery address");
        require(newRecoveryAddress != _recoveryAddress, "New recovery must be different");
        require(newRecoveryAddress != owner(), "Recovery address cannot be owner");

        return abi.encode(MultiPhaseSecureOperation.StandardExecutionOptions({
            functionSelector: bytes4(keccak256("_updateRecoveryAddress(address)")),
            params: abi.encode(newRecoveryAddress)
        }));
    }

    /**
     * @dev Updates the recovery address
     * @param metaTx The meta-transaction
     * @return The execution options
     */
    function updateRecoveryRequestAndApprove(
        MultiPhaseSecureOperation.MetaTransaction memory metaTx
    ) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        // TODO: check the parameters
        // require(newRecoveryAddress != address(0), "Invalid recovery address");
        // require(newRecoveryAddress != _recoveryAddress, "New recovery must be different");
        // require(newRecoveryAddress != owner(), "Recovery address cannot be owner");

        return _requestAndApprove(metaTx);
    }

    // TimeLock Management
    /**
     * @dev Updates the time lock period
     * @param newTimeLockPeriodInDays The new time lock period
     * @return The execution options
     */
    function updateTimeLockExecutionOptions(
        uint256 newTimeLockPeriodInDays
    ) public view returns (bytes memory) {
        require(newTimeLockPeriodInDays > 0, "Invalid timelock period");
        require(newTimeLockPeriodInDays != _timeLockPeriodInDays, "New timelock must be different");

        return abi.encode(MultiPhaseSecureOperation.StandardExecutionOptions({
            functionSelector: bytes4(keccak256("_updateTimeLockPeriod(uint256)")),
            params: abi.encode(newTimeLockPeriodInDays)
        }));
    }

    /**
     * @dev Updates the time lock period
     * @param metaTx The meta-transaction
     * @return The execution options
     */
    function updateTimeLockRequestAndApprove(
        MultiPhaseSecureOperation.MetaTransaction memory metaTx
    ) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        // TODO: check the parameters
        // require(newTimeLockPeriodInDays > 0, "Invalid timelock period");
        // require(newTimeLockPeriodInDays != _timeLockPeriodInDays, "New timelock must be different");

        return _requestAndApprove(metaTx);
    }

    // Getters
    /**
     * @dev Gets the complete operation history with no filters
     * @return The complete operation history
     */
    function getOperationHistory() public view returns (MultiPhaseSecureOperation.TxRecord[] memory) {
        uint256 totalTransactions = _secureState.getCurrentTxId();
        MultiPhaseSecureOperation.TxRecord[] memory history = new MultiPhaseSecureOperation.TxRecord[](totalTransactions);
        
        for (uint256 i = 0; i < totalTransactions; i++) {
            history[i] = _operationHistory[i];
        }
        
        return history;
    }

    /**
     * @dev Gets an operation
     * @param txId The transaction ID
     * @return The operation
     */
    function getOperation(uint256 txId) public view returns (MultiPhaseSecureOperation.TxRecord memory) {
        return _operationHistory[txId];
    }

    /**
     * @dev Adds an operation
     * @param txRecord The transaction record
     */
    function addOperation(MultiPhaseSecureOperation.TxRecord memory txRecord) internal virtual {
        _operationHistory[txRecord.txId] = txRecord;
        _secureState.setNextTxId();
    }

    /**
     * @dev Finalizes an operation
     * @param opData The operation data
     */
    function finalizeOperation(MultiPhaseSecureOperation.TxRecord memory opData) internal virtual {
    }

    /**
     * @dev Generates an unsigned meta-transaction
     * @param txRecord The transaction record
     * @param handlerContract The handler contract
     * @param handlerSelector The handler selector
     * @param deadline The deadline
     * @param maxGasPrice The max gas price
     * @param signer The signer
     * @return The unsigned meta-transaction
     */
    function generateUnsignedMetaTransaction(
        MultiPhaseSecureOperation.TxRecord memory txRecord,
        address handlerContract,
        bytes4 handlerSelector,
        uint256 deadline,
        uint256 maxGasPrice,
        address signer
    ) public view returns (MultiPhaseSecureOperation.MetaTransaction memory) {
        return _secureState.generateUnsignedMetaTransaction(
            txRecord,
            handlerContract,
            handlerSelector,
            deadline,
            maxGasPrice,
            signer
        );
    }

    /**
     * @dev Returns the broadcaster address
     * @return The broadcaster address
     */
    function getBroadcaster() public virtual view returns (address) {
        return _broadcaster;
    }

    /**
     * @dev Returns the recovery address
     * @return The recovery address
     */
    function getRecoveryAddress() public virtual view returns (address) {
        return _recoveryAddress;
    }

    /**
     * @dev Returns the time lock period
     * @return The time lock period
     */
    function getTimeLockPeriodInDays() public virtual view returns (uint256) {
        return _timeLockPeriodInDays;
    }

    // Internal functions
    /**
     * @dev Requests and approves a meta-transaction
     * @param metaTx The meta-transaction
     * @return The transaction record
     */
    function _requestAndApprove(
        MultiPhaseSecureOperation.MetaTransaction memory metaTx
    ) internal returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.requestAndApprove(metaTx);
        addOperation(txRecord);
        finalizeOperation(txRecord);
        return txRecord;
    }

    /**
     * @dev Updates the broadcaster address
     * @param newBroadcaster The new broadcaster address
     */
    function _updateBroadcaster(address newBroadcaster) internal virtual {
        address oldBroadcaster = _broadcaster;
        _broadcaster = newBroadcaster;
        _secureState.updateRole(MultiPhaseSecureOperation.BROADCASTER_ROLE, newBroadcaster);
        emit BroadcasterUpdated(oldBroadcaster, newBroadcaster);
    }

    /**
     * @dev Updates the recovery address
     * @param newRecoveryAddress The new recovery address
     */
    function _updateRecoveryAddress(address newRecoveryAddress) internal virtual {
        address oldRecovery = _recoveryAddress;
        _recoveryAddress = newRecoveryAddress;
        _secureState.updateRole(MultiPhaseSecureOperation.RECOVERY_ROLE, newRecoveryAddress);
        emit RecoveryAddressUpdated(oldRecovery, newRecoveryAddress);
    }

    /**
     * @dev Updates the time lock period
     * @param newTimeLockPeriodInDays The new time lock period
     */
    function _updateTimeLockPeriod(uint256 newTimeLockPeriodInDays) internal virtual {
        uint256 oldPeriod = _timeLockPeriodInDays;
        _timeLockPeriodInDays = newTimeLockPeriodInDays;
        _secureState.updateTimeLockPeriod(newTimeLockPeriodInDays);
        emit TimeLockPeriodUpdated(oldPeriod, newTimeLockPeriodInDays);
    }

    // Ownership overrides
    /**
     * @dev Returns the owner of the contract
     * @return The owner of the contract
     */
    function owner() public view virtual override(Ownable) returns (address) {
        return super.owner();
    }

    /**
     * @dev Checks if the owner is valid
     */
    function _checkOwner() internal view virtual override {
        super._checkOwner();
    }

    /**
     * @dev Transfers ownership of the contract
     * @param newOwner The new owner of the contract
     */
    function _transferOwnership(address newOwner) internal virtual override {
        address oldOwner = owner();
        super._transferOwnership(newOwner);
        _secureState.updateRole(MultiPhaseSecureOperation.OWNER_ROLE, newOwner);
        emit OwnershipTransferUpdated(oldOwner, owner());
    }

    /**
     * @dev Renounces ownership of the contract
     */
    function renounceOwnership() public virtual override onlyOwner {
        revert("Ownership renouncement disabled");
    }

    /**
     * @dev Transfers ownership of the contract
     * @param newOwner The new owner of the contract
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        revert("Direct ownership transfer disabled - use secure transfer process");
    }

    /**
     * @dev Internal function to get the secure state
     * @return secureState The secure state
     */
    function _getSecureState() internal view returns (MultiPhaseSecureOperation.SecureOperationState storage) {
        return _secureState;
    }

    /**
     * @dev Creates a new transaction record with basic fields populated.
     * @param target The target contract address
     * @param executionType The type of execution (STANDARD or RAW)
     * @param executionOptions The execution options for the transaction
     * @param value The value to send with the transaction
     * @param gasLimit The gas limit for the transaction
     * @return The created TxRecord
     */
    function createNewTxRecord(
        address requester,
        address target,
        bytes32 operationType,
        MultiPhaseSecureOperation.ExecutionType executionType,
        bytes memory executionOptions,
        uint256 value,
        uint256 gasLimit
    ) public view returns (MultiPhaseSecureOperation.TxRecord memory) {
        return _secureState.createNewTxRecord(
            requester,
            target,
            operationType,
            executionType,
            executionOptions,
            value,
            gasLimit
        );
    }

    /**
     * @dev Executes both native and ERC20 token payments in a single transaction
     * @param payment The PaymentDetails struct containing recipient and payment amounts
     * @param metaTx The MetaTransaction struct containing the signed approval
     */
    function makePayment(
        MultiPhaseSecureOperation.PaymentDetails calldata payment, 
        MultiPhaseSecureOperation.MetaTransaction calldata metaTx
    ) external onlyBroadcaster {
        require(metaTx.txRecord.target == address(this), "Can only pay for own actions");
        
        // Call internal implementation after security checks
        MultiPhaseSecureOperation.executePayment(_getSecureState(), payment, metaTx);
    }
    
    /**
     * @dev Checks if an operation type is supported
     * @param operationType The operation type to check
     * @return bool True if the operation type is supported
     */
    function isOperationTypeSupported(bytes32 operationType) public view returns (bool) {
        return _secureState.isOperationTypeSupported(operationType);
    }
}