import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/// <reference types="node" />

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function formatBalance(balance: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals)
  const integerPart = balance / divisor
  const fractionalPart = balance % divisor
  const paddedFractionalPart = fractionalPart.toString().padStart(decimals, "0")
  return `${integerPart}.${paddedFractionalPart.slice(0, 4)}`
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export const CHAINS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
} as const

export type Chain = typeof CHAINS[keyof typeof CHAINS]

export function getChainName(chainId: Chain): string {
  switch (chainId) {
    case CHAINS.MAINNET:
      return "Ethereum"
    case CHAINS.SEPOLIA:
      return "Sepolia"
    default:
      return "Unknown"
  }
}

export function isTestnet(chainId: Chain): boolean {
  return chainId === CHAINS.SEPOLIA
} 