import type { Abi } from 'viem'

export interface CompilerInput {
  language: 'Solidity'
  sources: {
    [file: string]: {
      content: string
    }
  }
  settings: {
    optimizer: {
      enabled: boolean
      runs: number
    }
    outputSelection: {
      [file: string]: {
        [contract: string]: string[]
      }
    }
  }
}

export interface CompilerError {
  severity: 'error' | 'warning'
  formattedMessage: string
}

export interface CompilerOutput {
  errors?: CompilerError[]
  contracts: {
    [file: string]: {
      [contract: string]: {
        abi: Abi
        evm: {
          bytecode: {
            object: string
          }
        }
      }
    }
  }
} 