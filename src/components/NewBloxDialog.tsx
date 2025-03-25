import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Info } from "lucide-react"
import { getAllContracts } from '@/lib/catalog'
import type { BloxContract } from '@/lib/catalog/types'
import { useChainId } from 'wagmi'
import { Badge } from "@/components/ui/badge"

interface NewBloxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewBloxDialog({ open, onOpenChange }: NewBloxDialogProps) {
  const navigate = useNavigate()
  const chainId = useChainId()
  const [bloxes, setBloxes] = useState<BloxContract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadBloxes = async () => {
      try {
        const contracts = await getAllContracts()
        setBloxes(contracts)
      } catch (error) {
        console.error('Failed to load bloxes:', error)
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      loadBloxes()
    }
  }, [open])

  const handleFactoryDeploy = (bloxId: string) => {
    navigate(`/factory-deploy/${bloxId}`)
    onOpenChange(false)
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
                        onClick={() => {
                          navigate(`/factory-deploy/${blox.id}`)
                          onOpenChange(false)
                        }}
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