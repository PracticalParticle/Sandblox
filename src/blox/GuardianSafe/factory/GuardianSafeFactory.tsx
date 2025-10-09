import { Address, createPublicClient, http, Abi } from 'viem';
import { sepolia } from 'viem/chains';
import FACTORY_ABI from './GuardianSafeFactory.abi.json';

export class GuardianSafeFactory {
  private client;

  constructor() {
    // Initialize public client for Sepolia
    this.client = createPublicClient({
      chain: sepolia,
      transport: http()
    });
  }

  /**
   * Creates a new GuardianSafe instance
   * @param params Creation parameters
   * @returns Transaction data
   */
  async createGuardianSafe(params: {
    safe: Address;
    owner: Address;
    broadcaster: Address;
    recovery: Address;
    timeLockPeriodInMinutes: number;
  }) {
    const { 
      safe,
      owner, 
      broadcaster, 
      recovery, 
      timeLockPeriodInMinutes 
    } = params;
    
    // Get factory address from config
    const factoryAddress = this.getFactoryAddress();

    // Prepare transaction data
    const data = {
      address: factoryAddress,
      abi: FACTORY_ABI as Abi,
      functionName: 'createGuardianSafe',
      args: [safe, owner, broadcaster, recovery, BigInt(timeLockPeriodInMinutes)]
    };

    return data;
  }

  /**
   * Checks if an address is a valid GuardianSafe
   */
  async isValidGuardianSafe(guardianSafeAddress: Address): Promise<boolean> {
    const factoryAddress = this.getFactoryAddress();
    
    return this.client.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI as Abi,
      functionName: 'checkGuardianSafe',
      args: [guardianSafeAddress]
    }) as Promise<boolean>;
  }

  /**
   * Gets the total number of guardian safes created
   */
  async getSafeCount(): Promise<bigint> {
    const factoryAddress = this.getFactoryAddress();
    
    return this.client.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI as Abi,
      functionName: 'safeCount'
    }) as Promise<bigint>;
  }

  /**
   * Gets the factory address for the current network
   */
  private getFactoryAddress(): Address {
    // Import deployment addresses from blox.json
    const config = require('../GuardianSafe.blox.json');
    const networkId = sepolia.id;

    if (!config.deployments?.[networkId]?.factory) {
      throw new Error(`No factory deployment found for network ${networkId}`);
    }

    return config.deployments[networkId].factory as Address;
  }
}
