import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { getContractDetails, getContractCode } from '../lib/catalog'
import type { BloxContract } from '../lib/catalog/types'
import Prism from 'prismjs'
import 'prismjs/components/prism-solidity'
import 'prismjs/themes/prism-tomorrow.css'
import { DeploymentDialog } from '../components/DeploymentDialog'
import { Button } from '../components/ui/button'
import ReactMarkdown from 'react-markdown'

// Custom styles for the code block
const codeBlockStyle = {
  background: 'transparent',
  fontSize: '0.875rem',
  lineHeight: 1.5,
  margin: 0,
  padding: 0,
}

export function ContractDetails() {
  const { contractId } = useParams<{ contractId: string }>()
  const { isConnected } = useAccount()
  const [contract, setContract] = useState<BloxContract | null>(null)
  const [contractCode, setContractCode] = useState<string>('')
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [isCodeExpanded, setIsCodeExpanded] = useState(false)
  const [isInfoExpanded, setIsInfoExpanded] = useState(true)

  useEffect(() => {
    if (contractId) {
      setLoading(true)
      setError(null)

      Promise.all([
        getContractDetails(contractId),
        getContractCode(contractId),
      ])
        .then(async ([details, code]) => {
          setContract(details)
          setContractCode(code)
          
          // Fetch the markdown content from the docs path
          try {
            if (details && details.files && details.files.docs) {
              const response = await fetch(details.files.docs)
              if (response.ok) {
                const markdown = await response.text()
                setMarkdownContent(markdown)
              } else {
                console.error('Failed to load markdown content:', response.statusText)
              }
            }
          } catch (err) {
            console.error('Error loading markdown content:', err)
          }
          
          // Highlight the code after it's loaded
          setTimeout(() => {
            Prism.highlightAll()
          }, 0)
        })
        .catch(err => {
          console.error(err)
          setError('Failed to load contract details')
        })
        .finally(() => setLoading(false))
    }
  }, [contractId])

  // Add new useEffect for code highlighting when expanded
  useEffect(() => {
    if (isCodeExpanded) {
      setTimeout(() => {
        Prism.highlightAll()
      }, 0)
    }
  }, [isCodeExpanded])

  // Handle dialog close - we don't need to do anything special here
  // as the DeploymentDialog component will handle adding the contract to the context
  const handleCloseDeployDialog = () => {
    setShowDeployDialog(false)
  }

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
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">{contract.name}</h1>
          </div>
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
          <div className="rounded-lg border">
            <button
              className="w-full flex items-center justify-between px-4 py-2 bg-muted/50 hover:bg-muted/70 transition-colors"
              onClick={() => setIsInfoExpanded(!isInfoExpanded)}
            >
              <h2 className="text-xl font-bold">Information</h2>
              {isInfoExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {isInfoExpanded && (
              <div className="p-4 space-y-4">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                    <span className="text-sm font-medium">{contract.files.docs.split('/').pop()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(markdownContent)
                      }}
                    >
                      Copy Content
                    </Button>
                  </div>
                  <div className="p-4 overflow-x-auto prose prose-sm max-w-none dark:prose-invert bg-card">
                    <ReactMarkdown>{markdownContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border">
            <button
              className="w-full flex items-center justify-between px-4 py-2 bg-muted/50 hover:bg-muted/70 transition-colors"
              onClick={() => setIsCodeExpanded(!isCodeExpanded)}
            >
              <h2 className="text-xl font-bold">Advanced</h2>
              {isCodeExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {isCodeExpanded && (
              <div className="p-4 space-y-4">
                <h3 className="text-lg font-semibold">Contract Code</h3>
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                    <span className="text-sm font-medium">{contract.files.sol.split('/').pop()}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(contractCode)
                        }}
                      >
                        Copy Code
                      </Button>
                      <Button
                        size="sm"
                        disabled={!isConnected}
                        onClick={() => setShowDeployDialog(true)}
                      >
                        {isConnected ? 'Deploy Contract' : 'Connect Wallet'}
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre style={codeBlockStyle}>
                      <code className="language-solidity">
                        {contractCode}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {contract && (
          <DeploymentDialog
            isOpen={showDeployDialog}
            onClose={handleCloseDeployDialog}
            contractId={contract.id}
            contractName={contract.name}
          />
        )}
      </div>
    </div>
  )
} 