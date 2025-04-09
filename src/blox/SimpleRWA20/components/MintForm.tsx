import * as React from "react";
import { useState } from "react";
import { Address, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface MintFormProps {
  onSubmit: (to: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  decimals: number;
  canMint: boolean;
}

export function MintForm({ onSubmit, isLoading, decimals, canMint }: MintFormProps) {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Basic validation
      if (!to || !amount) {
        throw new Error("Please fill in all fields");
      }

      // Validate address format
      if (!to.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error("Invalid address format");
      }

      // Parse amount with decimals
      const parsedAmount = parseUnits(amount, decimals);

      await onSubmit(to as Address, parsedAmount);
      
      // Clear form on success
      setTo("");
      setAmount("");
    } catch (err: any) {
      setError(err.message || "Failed to mint tokens");
    }
  };

  if (!canMint) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to mint tokens. Only the owner can mint tokens.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="to">Recipient Address</Label>
        <Input
          id="to"
          placeholder="0x..."
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="any"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading || !to || !amount}>
        {isLoading ? "Signing..." : "Sign Mint Transaction"}
      </Button>
    </form>
  );
} 