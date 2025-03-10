import {formatEther, formatUnits } from "viem";
import { Skeleton } from "@/components/ui/skeleton";

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  website?: string;
}

export interface TokenState {
  balance: bigint;
  metadata?: TokenMetadata;
  loading: boolean;
  error?: string;
}

export interface TokenBalanceState {
  [key: string]: TokenState;
}

export interface TokenListProps {
  ethBalance: bigint;
  tokenBalances: TokenBalanceState;
}

export const TokenList = ({ ethBalance, tokenBalances }: TokenListProps) => {
  return (
    <div className="space-y-4">
      {/* ETH Balance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="font-medium">ETH</div>
          <div className="text-2xl">{formatEther(ethBalance)}</div>
        </div>
      </div>

      {/* Token Balances */}
      {Object.entries(tokenBalances).map(([address, token]) => (
        <div key={address} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="font-medium">
              {token.loading ? (
                <Skeleton className="h-6 w-20" />
              ) : token.error ? (
                <span className="text-destructive">Error loading token</span>
              ) : (
                token.metadata?.symbol || "Unknown Token"
              )}
            </div>
            <div className="text-2xl">
              {token.loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                formatUnits(token.balance, token.metadata?.decimals || 18)
              )}
            </div>
          </div>
          {token.metadata?.name && (
            <div className="text-sm text-muted-foreground">{token.metadata.name}</div>
          )}
        </div>
      ))}
    </div>
  );
}; 