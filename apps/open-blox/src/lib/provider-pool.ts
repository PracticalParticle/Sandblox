import UniversalProvider from '@walletconnect/universal-provider';
import { WalletConnectError, ErrorCodes } from './errors';

interface PooledProvider {
  provider: InstanceType<typeof UniversalProvider>;
  lastUsed: number;
  isConnected: boolean;
}

export class ProviderPool {
  private static instance: ProviderPool;
  private providers: Map<string, PooledProvider> = new Map();
  private maxPoolSize = 3;
  private maxIdleTime = 5 * 60 * 1000; // 5 minutes
  private connectionTimeout = 30 * 1000; // 30 seconds

  private constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  public static getInstance(): ProviderPool {
    if (!ProviderPool.instance) {
      ProviderPool.instance = new ProviderPool();
    }
    return ProviderPool.instance;
  }

  public async getProvider(projectId: string, metadata: any): Promise<InstanceType<typeof UniversalProvider>> {
    try {
      // Always clear WalletConnect session storage before getting a provider
      localStorage.removeItem('walletconnect');
      
      // Remove any existing provider for this project
      await this.removeProvider(projectId);

      // Create new provider
      const provider = await this.createProvider(projectId, metadata);

      // Set up event listeners with proper cleanup
      const connectHandler = () => {
        const pooled = this.providers.get(projectId);
        if (pooled) {
          pooled.isConnected = true;
          pooled.lastUsed = Date.now();
        }
      };

      const disconnectHandler = () => {
        const pooled = this.providers.get(projectId);
        if (pooled) {
          pooled.isConnected = false;
          // Clean up on disconnect
          void this.removeProvider(projectId);
        }
      };

      provider.on('connect', connectHandler);
      provider.on('disconnect', disconnectHandler);

      // Set up session expiry handler
      provider.on('session_expire', () => {
        void this.removeProvider(projectId);
      });

      // Set up error handler
      provider.on('error', (error: Error) => {
        console.error('Provider error:', error);
        void this.removeProvider(projectId);
      });

      this.providers.set(projectId, {
        provider,
        lastUsed: Date.now(),
        isConnected: false
      });

      return provider;
    } catch (error) {
      // Ensure cleanup on error
      await this.removeProvider(projectId);
      throw new WalletConnectError(
        'Failed to initialize provider',
        ErrorCodes.PROVIDER_ERROR,
        error
      );
    }
  }

  private async createProvider(
    projectId: string,
    metadata: any
  ): Promise<InstanceType<typeof UniversalProvider>> {
    try {
      const provider = await UniversalProvider.init({
        projectId,
        metadata,
        relayUrl: "wss://relay.walletconnect.com",
        logger: 'error'
      });

      // Set up event listeners with proper cleanup
      const connectHandler = () => {
        const pooled = this.providers.get(projectId);
        if (pooled) {
          pooled.isConnected = true;
          pooled.lastUsed = Date.now();
        }
      };

      const disconnectHandler = () => {
        const pooled = this.providers.get(projectId);
        if (pooled) {
          pooled.isConnected = false;
          // Clean up on disconnect
          void this.removeProvider(projectId);
        }
      };

      provider.on('connect', connectHandler);
      provider.on('disconnect', disconnectHandler);

      // Set up session expiry handler
      provider.on('session_expire', () => {
        void this.removeProvider(projectId);
      });

      // Set up error handler
      provider.on('error', (error: Error) => {
        console.error('Provider error:', error);
        void this.removeProvider(projectId);
      });

      this.providers.set(projectId, {
        provider,
        lastUsed: Date.now(),
        isConnected: false
      });

      return provider;
    } catch (error) {
      throw new WalletConnectError(
        'Failed to initialize provider',
        ErrorCodes.PROVIDER_ERROR,
        error
      );
    }
  }

  private async removeProvider(projectId: string): Promise<void> {
    const pooled = this.providers.get(projectId);
    if (pooled) {
      try {
        const provider = pooled.provider;
        
        // Remove all event listeners
        provider.removeListener('connect', () => {});
        provider.removeListener('disconnect', () => {});
        provider.removeListener('session_expire', () => {});
        provider.removeListener('error', () => {});
        
        // Disconnect if connected
        if (pooled.isConnected) {
          await provider.disconnect().catch(console.error);
        }

        // Reset the provider's internal state
        (provider as any).walletConnectProvider = undefined;

        // Clear WalletConnect session storage
        localStorage.removeItem('walletconnect');
        
        this.providers.delete(projectId);
      } catch (error) {
        console.error('Error removing provider:', error);
      }
    }
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const idsToRemove: string[] = [];

    this.providers.forEach((pooled, id) => {
      if (!pooled.isConnected && now - pooled.lastUsed > this.maxIdleTime) {
        idsToRemove.push(id);
      }
    });

    for (const id of idsToRemove) {
      await this.removeProvider(id);
    }
  }

  public async disconnectAll(): Promise<void> {
    const providers = Array.from(this.providers.entries());
    for (const [id] of providers) {
      await this.removeProvider(id);
    }
  }

  public getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
} 