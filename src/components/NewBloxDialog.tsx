import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface NewBloxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewBloxDialog({ open, onOpenChange }: NewBloxDialogProps) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Blox</DialogTitle>
          <DialogDescription>
            Choose a Blox type to deploy a new secure contract.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" 
                onClick={() => navigate('/contracts/simple-vault')}>
            <CardHeader>
              <CardTitle>SimpleVault</CardTitle>
              <CardDescription>
                A secure vault with time-locked withdrawals and meta-transaction support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Features: Time-locked withdrawals, meta-transactions, multi-signature support, 
                and emergency recovery options.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
} 