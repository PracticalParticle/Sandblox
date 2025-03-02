import { WalletConnectModal } from '@walletconnect/modal';
import { UniversalProvider } from '@walletconnect/universal-provider';
import { WalletConnectError, ErrorCodes } from './errors';
import type { Chain } from '@/lib/utils';

type WCProvider = {
  connect(args: any): Promise<any>;
  disconnect(): Promise<void>;
  request(args: any): Promise<any>;
  on(event: string, callback: (data: any) => void): void;
};

interface WalletSession {
  provider: WCProvider;
  modal: WalletConnectModal;
  lastUsed: number;
  isConnected: boolean;
}

export class ProviderPool {
  private static instance: ProviderPool;
  private sessions: Map<string, WalletSession> = new Map();
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

  public async getProvider(
    projectId: string, 
    metadata: any,
    chains: Chain[] = [1]
  ): Promise<{ provider: WCProvider; modal: WalletConnectModal }> {
    try {
      // Always clear WalletConnect session storage before getting a new provider
      localStorage.removeItem('walletconnect');
      
      // Remove any existing session for this project
      await this.removeSession(projectId);

      // Create new provider and modal
      const { provider, modal } = await this.createSession(projectId, metadata, chains);

      this.sessions.set(projectId, {
        provider,
        modal,
        lastUsed: Date.now(),
        isConnected: false
      });

      return { provider, modal };
    } catch (error) {
      // Ensure cleanup on error
      await this.removeSession(projectId);
      throw new WalletConnectError(
        'Failed to initialize WalletConnect',
        ErrorCodes.PROVIDER_ERROR,
        error
      );
    }
  }

  private async createSession(
    projectId: string,
    metadata: any,
    chains: Chain[]
  ): Promise<{ provider: WCProvider; modal: WalletConnectModal }> {
    try {
      // Initialize provider first
      const provider = await UniversalProvider.init({
        projectId,
        metadata,
        logger: 'error'
      }) as unknown as WCProvider;

      // Then initialize modal
      const modal = new WalletConnectModal({
        projectId,
        themeMode: 'dark',
        explorerRecommendedWalletIds: [],
        explorerExcludedWalletIds: [],
        chains: chains.map(id => `eip155:${id}`),
        mobileWallets: [],
        desktopWallets: [],
        walletImages: {},
        themeVariables: {
          '--wcm-z-index': '9999',
          '--wcm-accent-color': '#3b82f6',
          '--wcm-accent-fill-color': '#3b82f6',
          '--wcm-background-color': '#1a1b1f',
          '--wcm-background-border-radius': '24px',
          '--wcm-container-border-radius': '24px',
          '--wcm-wallet-icon-border-radius': '12px',
          '--wcm-input-border-radius': '12px',
          '--wcm-button-border-radius': '12px',
          '--wcm-notification-border-radius': '12px',
          '--wcm-secondary-button-border-radius': '12px',
          '--wcm-font-family': '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu'
        }
      });

      return { provider, modal };
    } catch (error) {
      throw new WalletConnectError(
        'Failed to initialize WalletConnect session',
        ErrorCodes.PROVIDER_ERROR,
        error
      );
    }
  }

  private async removeSession(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (session) {
      try {
        const { provider, modal } = session;
        if (session.isConnected) {
          await provider.disconnect().catch(console.error);
        }
        modal.closeModal();
        localStorage.removeItem('walletconnect');
        this.sessions.delete(projectId);
      } catch (error) {
        console.error('Error removing session:', error);
      }
    }
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const idsToRemove: string[] = [];

    this.sessions.forEach((session, id) => {
      if (!session.isConnected && now - session.lastUsed > this.maxIdleTime) {
        idsToRemove.push(id);
      }
    });

    for (const id of idsToRemove) {
      await this.removeSession(id);
    }
  }

  public async disconnectAll(): Promise<void> {
    const sessions = Array.from(this.sessions.entries());
    for (const [id] of sessions) {
      await this.removeSession(id);
    }
  }

  public getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
}