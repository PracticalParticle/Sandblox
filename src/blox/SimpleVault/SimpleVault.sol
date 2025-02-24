// SPDX-License-Identifier:
pragma solidity ^0.8.0;

// OpenZeppelin imports
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Particle imports
import "../../contracts-core/SecureOwnable/SecureOwnable.sol";

contract SimpleVault is SecureOwnable {
    using SafeERC20 for IERC20;

    // Constants for operation types
    bytes32 public constant WITHDRAW_ETH = keccak256("WITHDRAW_ETH");
    bytes32 public constant WITHDRAW_TOKEN = keccak256("WITHDRAW_TOKEN");

    // Events
    event EthWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EthReceived(address indexed from, uint256 amount);

    /**
     * @notice Constructor to initialize SimpleVault
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
    ) SecureOwnable(initialOwner, recoveryAddr, timeLockPeriodInDays, broadcaster) {
        require(timeLockPeriodInDays < 30, "Time lock period must be less than 30 days");
        
        MultiPhaseSecureOperation.addOperationType(_getSecureState(), WITHDRAW_ETH);
        MultiPhaseSecureOperation.addOperationType(_getSecureState(), WITHDRAW_TOKEN);
    }

    /**
     * @dev Allows the contract to receive ETH
     */
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    /**
     * @notice Get the ETH balance of the vault
     */
    function getEthBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get the token balance of the vault
     * @param token Token address
     */
    function getTokenBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Request ETH withdrawal
     * @param to Recipient address
     * @param amount Amount of ETH to withdraw
     */
    function withdrawEthRequest(address to, uint256 amount) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        require(to != address(0), "Invalid recipient");
        require(amount <= getEthBalance(), "Insufficient balance");

        bytes memory executionOptions = abi.encode(MultiPhaseSecureOperation.StandardExecutionOptions({
            functionSelector: bytes4(keccak256("_withdrawEth(address,uint256)")),
            params: abi.encode(to, amount)
        }));

        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.txRequest(
            _getSecureState(),
            msg.sender,
            address(this),
            WITHDRAW_ETH,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions,
            0, // No ETH should be sent with withdrawal request
            gasleft()
        );

        addOperation(txRecord);
        return txRecord;
    }

    /**
     * @notice Request token withdrawal
     * @param token Token address
     * @param to Recipient address
     * @param amount Amount of tokens to withdraw
     */
    function withdrawTokenRequest(address token, address to, uint256 amount) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        require(amount <= getTokenBalance(token), "Insufficient balance");

        bytes memory executionOptions = abi.encode(MultiPhaseSecureOperation.StandardExecutionOptions({
            functionSelector: bytes4(keccak256("_withdrawToken(address,address,uint256)")),
            params: abi.encode(token, to, amount)
        }));

        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.txRequest(
            _getSecureState(),
            msg.sender,
            address(this),
            WITHDRAW_TOKEN,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions,
            0,
            gasleft()
        );

        addOperation(txRecord);
        return txRecord;
    }

    /**
     * @notice Approve a withdrawal after the time delay has passed
     * @param txId The ID of the withdrawal transaction to approve
     */
    function approveWithdrawalAfterDelay(uint256 txId) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.txDelayedApproval(
            _getSecureState(),
            txId
        );
        return txRecord;
    }

    /**
     * @notice Approve withdrawal with meta transaction
     * @param metaTx Meta transaction data
     */
    function approveWithdrawalWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.txApprovalWithMetaTx(
            _getSecureState(),
            metaTx
        ); 
        return txRecord;
    }

    /**
     * @notice Cancel a pending withdrawal request
     * @param txId The ID of the withdrawal transaction to cancel
     */
    function cancelWithdrawal(uint256 txId) public onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory) {
        MultiPhaseSecureOperation.TxRecord memory currentTxRecord = MultiPhaseSecureOperation.getTxRecord(_getSecureState(), txId);
        require(block.timestamp >= currentTxRecord.releaseTime - (_getSecureState().timeLockPeriodInDays * 1 days) + 1 hours, "Cannot cancel within first hour");

        MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.txCancellation(
            _getSecureState(),
            txId
        );
        return txRecord;
    }

    /**
     * @dev Internal function to withdraw ETH
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function _withdrawEth(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
        emit EthWithdrawn(to, amount);
    }

    /**
     * @dev Internal function to withdraw tokens
     * @param token Token address
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function _withdrawToken(address token, address to, uint256 amount) internal {
        IERC20(token).safeTransfer(to, amount);
        emit TokenWithdrawn(token, to, amount);
    }
}
