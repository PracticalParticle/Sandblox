import { WalletConnectModal } from '@walletconnect/modal';
import { WalletConnectError, ErrorCodes } from './errors';

interface ModalSession {
  modal: WalletConnectModal;
  lastUsed: number;
  isConnected: boolean;
}

export class ProviderPool {
  private static instance: ProviderPool;
  private modals: Map<string, ModalSession> = new Map();
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

  public async getProvider(projectId: string, metadata: any): Promise<WalletConnectModal> {
    try {
      // Always clear WalletConnect session storage before getting a new modal
      localStorage.removeItem('walletconnect');
      
      // Remove any existing modal for this project
      await this.removeModal(projectId);

      // Create new modal
      const modal = await this.createModal(projectId, metadata);

      this.modals.set(projectId, {
        modal,
        lastUsed: Date.now(),
        isConnected: false
      });

      return modal;
    } catch (error) {
      // Ensure cleanup on error
      await this.removeModal(projectId);
      throw new WalletConnectError(
        'Failed to initialize WalletConnect',
        ErrorCodes.PROVIDER_ERROR,
        error
      );
    }
  }

  private async createModal(
    projectId: string,
    metadata: any
  ): Promise<WalletConnectModal> {
    try {
      const modal = new WalletConnectModal({
        projectId,
        themeMode: 'dark',
        explorerRecommendedWalletIds: undefined,
        explorerExcludedWalletIds: undefined,
        chains: ['eip155:1'], // Default to Ethereum mainnet
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

      this.modals.set(projectId, {
        modal,
        lastUsed: Date.now(),
        isConnected: false
      });

      return modal;
    } catch (error) {
      throw new WalletConnectError(
        'Failed to initialize WalletConnect modal',
        ErrorCodes.PROVIDER_ERROR,
        error
      );
    }
  }

  private async removeModal(projectId: string): Promise<void> {
    const session = this.modals.get(projectId);
    if (session) {
      try {
        const modal = session.modal;
        modal.closeModal();
        
        // Clear WalletConnect session storage
        localStorage.removeItem('walletconnect');
        
        this.modals.delete(projectId);
      } catch (error) {
        console.error('Error removing modal:', error);
      }
    }
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const idsToRemove: string[] = [];

    this.modals.forEach((session, id) => {
      if (!session.isConnected && now - session.lastUsed > this.maxIdleTime) {
        idsToRemove.push(id);
      }
    });

    for (const id of idsToRemove) {
      await this.removeModal(id);
    }
  }

  public async disconnectAll(): Promise<void> {
    const sessions = Array.from(this.modals.entries());
    for (const [id] of sessions) {
      await this.removeModal(id);
    }
  }

  public getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
} 