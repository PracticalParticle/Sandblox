import type { Abi } from 'viem'

interface SolcWrapper {
  compile: (input: string) => string
  version: () => string
}

interface CompilerInput {
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

interface CompilerError {
  severity: 'error' | 'warning'
  formattedMessage: string
}

interface CompilerOutput {
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

let solcCache: Record<string, SolcWrapper> = {}

export async function loadCompiler(version: string): Promise<SolcWrapper> {
  if (solcCache[version]) {
    return solcCache[version]
  }

  try {
    // @ts-ignore
    const solc = await import('solc')
    const compiler = solc.default as SolcWrapper

    // Cache the compiler instance
    solcCache[version] = compiler
    return compiler
  } catch (error) {
    throw new Error(`Failed to load Solidity compiler version ${version}: ${error}`)
  }
}

export type { CompilerInput, CompilerOutput, CompilerError } 