import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import type { SecureContractInfo } from '@/lib/types';

interface DeployedContractContextType {
  addDeployedContract: (contractInfo: SecureContractInfo) => void;
  lastDeployedContract: SecureContractInfo | null;
}

const DeployedContractContext = createContext<DeployedContractContextType | null>(null);

export function DeployedContractProvider({ children }: { children: ReactNode }) {
  const [lastDeployedContract, setLastDeployedContract] = useState<SecureContractInfo | null>(null);

  const addDeployedContract = useCallback((contractInfo: SecureContractInfo) => {
    setLastDeployedContract(contractInfo);
  }, []);

  return (
    <DeployedContractContext.Provider 
      value={{ 
        addDeployedContract, 
        lastDeployedContract 
      }}
    >
      {children}
    </DeployedContractContext.Provider>
  );
}

export function useDeployedContract(): DeployedContractContextType {
  const context = useContext(DeployedContractContext);
  if (!context) {
    throw new Error('useDeployedContract must be used within a DeployedContractProvider');
  }
  return context;
} 