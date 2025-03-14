import { createContext, useContext, ReactNode, useState, useCallback, useRef } from 'react';
import type { SecureContractInfo } from '@/lib/types';

interface DeployedContractContextType {
  addDeployedContract: (contractInfo: SecureContractInfo) => void;
  lastDeployedContract: SecureContractInfo | null;
}

const DeployedContractContext = createContext<DeployedContractContextType | null>(null);

export function DeployedContractProvider({ children }: { children: ReactNode }) {
  const [lastDeployedContract, setLastDeployedContract] = useState<SecureContractInfo | null>(null);
  const lastAddedAddressRef = useRef<string | null>(null);

  const addDeployedContract = useCallback((contractInfo: SecureContractInfo) => {
    // Ensure we have a valid contract address
    if (!contractInfo.contractAddress) {
      console.error('Attempted to add contract with missing address');
      return;
    }
    
    // Prevent adding the same contract address twice in a row
    if (lastAddedAddressRef.current === contractInfo.contractAddress) {
      console.log('Contract already added, skipping duplicate', contractInfo.contractAddress);
      return;
    }
    
    // Update the ref and state
    lastAddedAddressRef.current = contractInfo.contractAddress;
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