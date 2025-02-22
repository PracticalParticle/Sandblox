import { useNavigate } from 'react-router-dom'
import { ArrowRight, Settings, Trash2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface NetworkType {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
  stats: {
    contracts: string;
    tvl: string;
    transactions: string;
  };
  isOfficial?: boolean;
  rpcUrls: string[];
  chainId?: string;
  isPublic?: boolean;
}

interface NetworkCardProps {
  chain: NetworkType;
  isCustom?: boolean;
  onEdit?: (network: NetworkType) => void;
  onDelete?: (networkId: string, isOfficial: boolean) => void;
}

export function NetworkCard({ chain, isCustom = false, onEdit, onDelete }: NetworkCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="p-6 hover:bg-card/80 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              {chain.icon}
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">{chain.name}</h3>
              <CheckCircle2 
                className={chain.isOfficial 
                  ? "h-4 w-4 text-primary" 
                  : "h-4 w-4 text-muted-foreground"
                } 
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{chain.description}</p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm font-medium">Contracts</p>
              <p className="text-sm text-muted-foreground">{chain.stats.contracts}</p>
            </div>
            <div>
              <p className="text-sm font-medium">TVL</p>
              <p className="text-sm text-muted-foreground">{chain.stats.tvl}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Tx/Day</p>
              <p className="text-sm text-muted-foreground">{chain.stats.transactions}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate(`/blockchains/${chain.id}`)}
            >
              <ArrowRight className="h-4 w-4" />
              View Details
            </Button>
          </div>
        </div>
        {(isCustom || chain.isOfficial) && onEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover/95">
              <DropdownMenuItem onClick={() => onEdit(chain)}>
                Edit Network
              </DropdownMenuItem>
              {!chain.isOfficial && onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(chain.id, !!chain.isOfficial)}
                  className="text-destructive"
                >
                  Remove Network
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </Card>
  )
} 