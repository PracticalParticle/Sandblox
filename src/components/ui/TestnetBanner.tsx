import { AlertTriangle } from "lucide-react";

export function TestnetBanner() {
  return (
    <div className="w-full bg-yellow-500/90 backdrop-blur supports-[backdrop-filter]:bg-yellow-500/75 text-black py-2  z-[9999">
      <div className="container flex items-center gap-x-2 justify-center text-sm font-medium">
        <AlertTriangle className="h-4 w-4" />
        <p>
          This is an experimental application for the Sepolia testnet use only. Do not use with real assets. {' '}
          <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" 
             target="_blank" 
             rel="noopener noreferrer" 
             className="underline">
            Get Sepolia ETH here.
          </a>
        </p>
      </div>
    </div>
  );
} 