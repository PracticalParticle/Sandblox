import { useNetwork } from 'wagmi';

export function useChain() {
  const { chain } = useNetwork();
  return { chain };
} 