import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Clock, Copy, SwitchCamera } from 'lucide-react';
import type { SecureContractInfo } from '@/lib/types';
import { truncateAddress } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ContractInfoProps {
  address?: string;
  contractInfo?: SecureContractInfo;
  className?: string;
  connectedAddress?: string;
  referenceLink?: string;
  onConnect?: (role: 'owner' | 'broadcaster' | 'recovery') => void;
  navigationIcon?: React.ReactNode;
  navigationTooltip?: string;
  navigateTo?: string;
}

// Helper function to format time values
const formatTimeValue = (minutes: number): string => {
  const days = Math.floor(minutes / 1440);
  const remainingMinutes = minutes % 1440;
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);

  return parts.join(' ');
};

// Helper function to check for duplicate addresses
const checkDuplicateAddresses = (contractInfo?: SecureContractInfo): { hasDuplicates: boolean; duplicateRoles: string[] } => {
  if (!contractInfo) return { hasDuplicates: false, duplicateRoles: [] };

  const { owner, broadcaster, recoveryAddress } = contractInfo;
  const duplicateRoles: string[] = [];

  // Check if all addresses are the same
  if (owner && broadcaster && recoveryAddress &&
      owner.toLowerCase() === broadcaster.toLowerCase() && 
      owner.toLowerCase() === recoveryAddress.toLowerCase()) {
    return {
      hasDuplicates: true,
      duplicateRoles: ['broadcaster and recovery']
    };
  }

  // Check individual duplicates
  if (broadcaster && owner && broadcaster.toLowerCase() === owner.toLowerCase()) {
    duplicateRoles.push('broadcaster');
  }
  if (recoveryAddress && owner && recoveryAddress.toLowerCase() === owner.toLowerCase()) {
    duplicateRoles.push('recovery');
  }
  // Only check broadcaster and recovery if they're not both the same as owner
  if (broadcaster && recoveryAddress && 
      broadcaster.toLowerCase() === recoveryAddress.toLowerCase() &&
      (!owner || 
        (broadcaster.toLowerCase() !== owner.toLowerCase() || 
         recoveryAddress.toLowerCase() !== owner.toLowerCase()))) {
    return {
      hasDuplicates: true,
      duplicateRoles: ['broadcaster and recovery']
    };
  }

  return {
    hasDuplicates: duplicateRoles.length > 0,
    duplicateRoles
  };
};

export function ContractInfo({ 
  address, 
  contractInfo, 
  className = '',
  connectedAddress,
  onConnect,
  navigationIcon,
  navigationTooltip,
  navigateTo
}: ContractInfoProps) {
  const navigate = useNavigate();
  const timeLockPeriod = contractInfo?.timeLockPeriodInMinutes ?? 0;
  const showMinutes = timeLockPeriod >= 1440;

  const { hasDuplicates, duplicateRoles } = checkDuplicateAddresses(contractInfo);

  // Helper function to check if an address is connected
  const isRoleConnected = (roleAddress?: string): boolean => {
    if (!connectedAddress || !roleAddress) return false;
    return connectedAddress.toLowerCase() === roleAddress.toLowerCase();
  };

  // Helper function to handle wallet connection
  const handleConnect = (role: 'owner' | 'broadcaster' | 'recovery') => {
    onConnect?.(role);
  };

  return (
    <div className="space-y-4">
      {hasDuplicates && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500 text-red-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Security risk: {duplicateRoles.join(' and ')} {duplicateRoles[0].includes(' and ') ? 'addresses are' : 'address is'} the same as the owner address. 
            Please change {duplicateRoles[0].includes(' and ') ? 'these addresses' : 'this address'} to enhance security.
          </AlertDescription>
        </Alert>
      )}
      <Card className={`p-6 ${className}`}>
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold">Contract Information</h2>
          {navigationIcon && navigateTo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8 hover-lift"
                    onClick={() => navigate(navigateTo)}
                  >
                    {navigationIcon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{navigationTooltip || 'Navigate'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex mb-6 flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="font-mono shrink-0">
              Contract
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-muted-foreground font-mono text-sm truncate hover:cursor-pointer">
                    {truncateAddress(address || '')}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{address}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => navigator.clipboard.writeText(address || '')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy address</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="hidden sm:block h-4 w-[1px] bg-border shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="font-mono">
              Roles
            </Badge>
            <div className="flex -space-x-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <div className="h-2 w-2 rounded-full bg-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">3 Total</span>
          </div>
          <div className="hidden sm:block h-4 w-[1px] bg-border shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="font-mono shrink-0">
              TimeLock
            </Badge>
            <div className="flex items-center text-muted-foreground font-mono text-sm truncate">
              <Clock className="h-3 w-3 mr-1" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <span>{timeLockPeriod ? formatTimeValue(timeLockPeriod) : 'Loading...'}</span>
                    {showMinutes && (
                      <span className="text-xs opacity-50">({timeLockPeriod} min)</span>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>TimeLock Period</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Owner Address */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Owner</p>
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-sm font-mono truncate">
                    {truncateAddress(contractInfo?.owner || '')}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => navigator.clipboard.writeText(contractInfo?.owner || '')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy owner address</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {isRoleConnected(contractInfo?.owner) ? (
                  <Badge variant="default" className="bg-blue-500/10 text-blue-500 shrink-0 shadow-sm whitespace-nowrap">Connected</Badge>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-7 shadow-sm hover:bg-blue-500/5 shrink-0"
                          onClick={() => handleConnect('owner')}
                        >
                          <SwitchCamera className="h-3 w-3 mr-1" />
                          <span className="whitespace-nowrap">Connect</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Switch to owner wallet</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Broadcaster Address */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Broadcaster</p>
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-sm font-mono truncate">
                    {truncateAddress(contractInfo?.broadcaster || '')}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => navigator.clipboard.writeText(contractInfo?.broadcaster || '')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy broadcaster address</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {isRoleConnected(contractInfo?.broadcaster) ? (
                  <Badge variant="default" className="bg-purple-500/10 text-purple-500 shrink-0 shadow-sm whitespace-nowrap">Connected</Badge>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-7 shadow-sm hover:bg-purple-500/5 shrink-0"
                          onClick={() => handleConnect('broadcaster')}
                        >
                          <SwitchCamera className="h-3 w-3 mr-1" />
                          <span className="whitespace-nowrap">Connect</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Switch to broadcaster wallet</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Recovery Address */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Recovery</p>
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-sm font-mono truncate">
                    {truncateAddress(contractInfo?.recoveryAddress || '')}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => navigator.clipboard.writeText(contractInfo?.recoveryAddress || '')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy recovery address</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {isRoleConnected(contractInfo?.recoveryAddress) ? (
                  <Badge variant="default" className="bg-red-500/10 text-red-500 shrink-0 shadow-sm whitespace-nowrap">Connected</Badge>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-7 shadow-sm hover:bg-red-500/5 shrink-0"
                          onClick={() => handleConnect('recovery')}
                        >
                          <SwitchCamera className="h-3 w-3 mr-1" />
                          <span className="whitespace-nowrap">Connect</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Switch to recovery wallet</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
} 