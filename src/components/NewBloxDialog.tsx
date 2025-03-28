import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { getAllContracts } from '@/lib/catalog'
import type { BloxContract } from '@/lib/catalog/types'
import { useChainId } from 'wagmi'
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Address } from 'viem'

interface NewBloxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SelectedBlox extends BloxContract {
  factoryAddress: Address
}

export function NewBloxDialog({ open, onOpenChange }: NewBloxDialogProps) {
  const navigate = useNavigate()
  const chainId = useChainId()
  const [bloxes, setBloxes] = useState<BloxContract[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlox, setSelectedBlox] = useState<SelectedBlox | null>(null)
  const [FactoryDialog, setFactoryDialog] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset states when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBlox(null)
      setFactoryDialog(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    const loadBloxes = async () => {
      try {
        const contracts = await getAllContracts()
        setBloxes(contracts)
      } catch (error) {
        console.error('Failed to load bloxes:', error)
        setError('Failed to load available Blox types')
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      loadBloxes()
    }
  }, [open])

  const handleCreateClick = async (blox: BloxContract) => {
    if (!blox.files.factoryDialog) {
      navigate(`/contracts/${blox.id}`)
      onOpenChange(false)
      return
    }

    try {
      setError(null)
      console.log('Loading factory dialog from:', blox.files.factoryDialog)
      
      // Get the factory address for the current chain
      const factoryAddress = blox.deployments?.[chainId.toString()]?.factory
      if (!factoryAddress) {
        throw new Error(`No factory deployment found for chain ${chainId}`)
      }
      
      // Dynamic import of the factory dialog using the path from blox.files.factoryDialog
      const folderName = blox.files.factoryDialog.split('/').slice(-3)[0];
      const module = await import(`@/blox/${folderName}/factory/${folderName}Factory.dialog.tsx`);
      
      // The factory dialog should be the default export
      if (!module.default) {
        throw new Error(`Factory dialog component not found for ${blox.id}`)
      }

      setFactoryDialog(() => module.default)
      setSelectedBlox({ ...blox, factoryAddress: factoryAddress as Address })
    } catch (error) {
      console.error('Failed to load factory dialog:', error)
      setError('Failed to load factory dialog. Please try again.')
      // Don't navigate away on error, let the user try again
    }
  }

  if (selectedBlox && FactoryDialog) {
    return <FactoryDialog 
      open={open} 
      onOpenChange={onOpenChange} 
      factoryAddress={selectedBlox.factoryAddress} 
    />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Create New Blox</DialogTitle>
          <DialogDescription>
            Choose a Blox type to deploy a new secure contract.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2 py-4">
          {loading ? (
            <div className="text-center py-8">Loading available Blox...</div>
          ) : (
            bloxes.map((blox) => {
              const hasFactory = blox.deployments?.[chainId.toString()]?.factory
              
              return (
                <Card 
                  key={blox.id}
                  className="hover:border-primary transition-colors"
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="shrink-0">{blox.category}</Badge>
                      <div className="font-medium">{blox.name}</div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigate(`/contracts/${blox.id}`)
                          onOpenChange(false)
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!hasFactory}
                        onClick={() => handleCreateClick(blox)}
                      >
                        Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 