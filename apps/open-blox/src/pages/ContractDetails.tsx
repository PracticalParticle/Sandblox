import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getContractDetails, getContractCode } from '../lib/catalog'
import type { BloxContract } from '../lib/catalog/types'

export function ContractDetails() {
  const { contractId } = useParams<{ contractId: string }>()
  const { isConnected } = useAccount()
  const [contract, setContract] = useState<BloxContract | null>(null)
  const [contractCode, setContractCode] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contractId) {
      setLoading(true)
      setError(null)

      Promise.all([
        getContractDetails(contractId),
        getContractCode(contractId)
      ])
        .then(([details, code]) => {
          setContract(details)
          setContractCode(code)
        })
        .catch(err => {
          console.error(err)
          setError('Failed to load contract details')
        })
        .finally(() => setLoading(false))
    }
  }, [contractId])

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading contract details...</p>
        </div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {error || 'Contract Not Found'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {error 
              ? 'There was an error loading the contract details. Please try again later.'
              : 'The contract you\'re looking for doesn\'t exist.'}
          </p>
          <Link
            to="/blox-contracts"
            className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            ← Back to Blox Contracts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-16">
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col space-y-4">
          <Link
            to="/blox-contracts"
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            ← Back to Blox Contracts
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{contract.name}</h1>
          <div className="space-x-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              {contract.category}
            </span>
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              {contract.securityLevel}
            </span>
          </div>
          <p className="text-lg items-center text-muted-foreground">
            {contract.description}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 bg-card p-4 rounded-lg">
            <h2 className="text-xl font-bold">Features</h2>
            <div className="space-y-2">
              {contract.features.map((feature) => (
                <p key={feature} className="text-muted-foreground">
                  {feature}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-4 bg-card p-4 rounded-lg">
            <h2 className="text-xl font-bold">Requirements</h2>
            <div className="space-y-2">
              {contract.requirements.map((requirement) => (
                <p key={requirement} className="text-muted-foreground">
                  {requirement}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Contract Code</h2>
          <div className="rounded-lg border bg-card p-4">
            <pre className="overflow-x-auto text-sm">
              <code>{contractCode}</code>
            </pre>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            className="btn"
            disabled={!isConnected}
          >
            {isConnected ? 'Deploy Contract' : 'Connect Wallet to Deploy'}
          </button>
        </div>
      </div>
    </div>
  )
} 