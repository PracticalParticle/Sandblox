import { motion } from 'framer-motion'
import { Shield, Radio, Key, Eye, LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WalletStatusBadgeProps {
  connectedAddress?: string
  contractInfo?: {
    owner: string
    broadcaster: string
    recoveryAddress: string
  }
  onDisconnect: () => void
}

export function WalletStatusBadge({ 
  connectedAddress, 
  contractInfo,
  onDisconnect 
}: WalletStatusBadgeProps) {
  if (!connectedAddress) return null

  const isRoleConnected = (roleAddress: string) => {
    return connectedAddress?.toLowerCase() === roleAddress?.toLowerCase()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 bg-card rounded-lg px-4 py-2 border shadow-sm shrink-0"
    >
      <div className="flex flex-col items-start">
        <div className="flex flex-wrap items-center gap-2">
          {contractInfo && isRoleConnected(contractInfo.owner) && (
            <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 font-medium">
              <Shield className="h-3 w-3 mr-1" />
              Owner
            </Badge>
          )}
          {contractInfo && isRoleConnected(contractInfo.broadcaster) && (
            <Badge variant="default" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 font-medium">
              <Radio className="h-3 w-3 mr-1" />
              Broadcaster
            </Badge>
          )}
          {contractInfo && isRoleConnected(contractInfo.recoveryAddress) && (
            <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 font-medium">
              <Key className="h-3 w-3 mr-1" />
              Recovery
            </Badge>
          )}
          {contractInfo && !isRoleConnected(contractInfo.owner) && 
           !isRoleConnected(contractInfo.broadcaster) && 
           !isRoleConnected(contractInfo.recoveryAddress) && (
            <Badge variant="default" className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 font-medium">
              <Eye className="h-3 w-3 mr-1" />
              Observer
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="font-mono text-xs">Wallet</Badge>
          <p className="text-xs text-muted-foreground font-mono">
            {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
          </p>
        </div>
      </div>
      <div className="h-8 w-[1px] bg-border/50" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={onDisconnect}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Disconnect wallet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  )
} 