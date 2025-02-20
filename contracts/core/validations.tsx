import { Address, PublicClient } from 'viem';
import { MetaTransaction, TxRecord, PaymentDetails } from './iCore';

export class ContractValidations {
  constructor(
    private client: PublicClient
  ) {}

  /**
   * @notice Validates a meta transaction's parameters
   * @param metaTx The meta transaction to validate
   * @throws Error if any validation fails
   */
  async validateMetaTransaction(metaTx: MetaTransaction): Promise<void> {    
    // Validate signature
    if (!metaTx.signature || metaTx.signature.length !== 65) {
      throw new Error("Invalid signature length");
    }

    // Validate chain ID
    const currentChainId = await this.client.getChainId();
    if (BigInt(metaTx.chainId) !== BigInt(currentChainId)) {
      throw new Error("Chain ID mismatch");
    }

    // Validate handler contract
    if (!metaTx.handlerContract) {
      throw new Error("Invalid handler contract address");
    }

    // Validate handler selector (must be 4 bytes)
    if (!metaTx.handlerSelector || !(/^0x[0-9a-f]{8}$/i.test(metaTx.handlerSelector))) {
      throw new Error("Invalid handler selector format");
    }

    // Validate deadline
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp > metaTx.deadline) {
      throw new Error("Meta-transaction expired");
    }

    // Validate max gas price
    const currentGasPrice = await this.client.getGasPrice();
    if (currentGasPrice > BigInt(metaTx.maxGasPrice)) {
      throw new Error("Current gas price exceeds maximum allowed");
    }

    // Validate signer
    if (!metaTx.signer) {
      throw new Error("Invalid signer address");
    }

    // Validate transaction record
    await this.validateTxRecord(metaTx.txRecord);
  }

  /**
   * @notice Validates a transaction record's parameters
   * @param txRecord The transaction record to validate
   * @throws Error if any validation fails
   * @private
   */
  private async validateTxRecord(txRecord: TxRecord): Promise<void> {
    // Validate txId
    if (txRecord.txId <= 0) {
      throw new Error("Invalid transaction ID");
    }

    // Validate release time
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (txRecord.releaseTime <= currentTimestamp) {
      throw new Error("Release time must be in the future");
    }

    // Validate requester address
    if (!txRecord.requester) {
      throw new Error("Invalid requester address");
    }

    // Validate target address
    if (!txRecord.target) {
      throw new Error("Invalid target address");
    }

    // Validate execution type
    if (![0, 1, 2].includes(txRecord.executionType)) {
      throw new Error("Invalid execution type");
    }

    // Validate execution options based on execution type
    if (!txRecord.executionOptions || txRecord.executionOptions.length === 0) {
      throw new Error("Empty execution options");
    }

    // Validate value (must be non-negative)
    if (BigInt(txRecord.value) < BigInt(0)) {
      throw new Error("Negative value not allowed");
    }

    // Validate gas limit
    if (txRecord.gasLimit <= 0) {
      throw new Error("Invalid gas limit");
    }

    // Validate payment details if present
    if (txRecord.payment) {
      await this.validatePaymentDetails(txRecord.payment);
    }
  }

  /**
   * @notice Validates payment details
   * @param payment The payment details to validate
   * @throws Error if any validation fails
   * @private
   */
  private async validatePaymentDetails(payment: PaymentDetails): Promise<void> {
    // Validate recipient address if payment is specified
    if (BigInt(payment.nativeTokenAmount) > BigInt(0) || BigInt(payment.erc20TokenAmount) > BigInt(0)) {
      if (!payment.recipient) {
        throw new Error("Invalid payment recipient address");
      }
    }

    // Validate native token amount
    if (BigInt(payment.nativeTokenAmount) < BigInt(0)) {
      throw new Error("Negative native token amount not allowed");
    }

    // Validate ERC20 token details if specified
    if (BigInt(payment.erc20TokenAmount) > BigInt(0)) {
      if (!payment.erc20TokenAddress) {
        throw new Error("Invalid ERC20 token address");
      }
      if (BigInt(payment.erc20TokenAmount) < BigInt(0)) {
        throw new Error("Negative ERC20 token amount not allowed");
      }
    }
  }

  /**
   * @notice Validates if a timestamp is in the future
   * @param timestamp The timestamp to validate
   * @param errorMessage Custom error message
   * @throws Error if timestamp is not in the future
   */
  validateFutureTimestamp(timestamp: number, errorMessage: string = "Timestamp must be in the future"): void {
    if (timestamp <= Math.floor(Date.now() / 1000)) {
      throw new Error(errorMessage);
    }
  }

  /**
   * @notice Validates if a period in days is valid
   * @param periodInDays The period to validate
   * @param errorMessage Custom error message
   * @throws Error if period is not valid
   */
  validateTimePeriod(periodInDays: number, errorMessage: string = "Invalid time period"): void {
    if (periodInDays <= 0) {
      throw new Error(errorMessage);
    }
  }

  /**
   * @notice Validates if an address has admin owner role
   * @dev Equivalent to onlyAdminOwner modifier in Solidity
   * @param address The address to validate
   * @param adminOwner The expected admin owner address
   * @throws Error if address is not admin owner
   */
  validateAdminOwner(address: Address | undefined, adminOwner: Address): void {
    this.validateRole(address, adminOwner, "admin owner");
  }

  /**
   * @notice Validates if an address has broadcaster role
   * @dev Equivalent to onlyBroadcaster modifier in Solidity
   * @param address The address to validate
   * @param broadcaster The expected broadcaster address
   * @throws Error if address is not broadcaster
   */
  validateBroadcaster(address: Address | undefined, broadcaster: Address): void {
    this.validateRole(address, broadcaster, "broadcaster");
  }

  /**
   * @notice Validates if an address has recovery role
   * @dev Equivalent to onlyRecovery modifier in Solidity
   * @param address The address to validate
   * @param recovery The expected recovery address
   * @throws Error if address is not recovery address
   */
  validateRecovery(address: Address | undefined, recovery: Address): void {
    this.validateRole(address, recovery, "recovery owner");
  }

  /**
   * @notice Validates if an address has a specific role
   * @param address The address to validate
   * @param roleAddress The expected role address
   * @param roleName The name of the role for error messages
   * @throws Error if address doesn't match role address
   */
  validateRole(address: Address | undefined, roleAddress: Address, roleName: string): void {
    if (!address || address !== roleAddress) {
      throw new Error(`Restricted to ${roleName}`);
    }
  }

  /**
   * @notice Validates if an address has either of two roles
   * @param address The address to validate
   * @param role1Address First role address
   * @param role2Address Second role address
   * @param roleNames Names of the roles for error messages
   * @throws Error if address doesn't match either role
   */
  validateMultipleRoles(address: Address | undefined, role1Address: Address, role2Address: Address, roleNames: string): void {
    if (!address || (address !== role1Address && address !== role2Address)) {
      throw new Error(`Restricted to ${roleNames}`);
    }
  }

  /**
   * @notice Validates native token balance
   * @param contractAddress The contract address to check
   * @param requiredAmount The required balance amount
   * @throws Error if balance is insufficient
   */
  async validateNativeTokenBalance(contractAddress: Address, requiredAmount: bigint): Promise<void> {
    const balance = await this.client.getBalance({ address: contractAddress });
    if (balance < requiredAmount) {
      throw new Error("Insufficient native token balance");
    }
  }
}