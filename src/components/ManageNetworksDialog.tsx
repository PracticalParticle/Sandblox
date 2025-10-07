import { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';
import {
  getCustomNetworks,
  addCustomNetwork,
  removeCustomNetwork,
  getAllNetworks,
  isDefaultNetwork,
  type NetworkFormData,
} from '@/lib/networkStorage';

interface ManageNetworksDialogProps {
  children: React.ReactNode;
}

export function ManageNetworksDialog({ children }: ManageNetworksDialogProps) {
  const [open, setOpen] = useState(false);
  const [customNetworks, setCustomNetworks] = useState(getCustomNetworks());
  const [isAdding, setIsAdding] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [formData, setFormData] = useState<NetworkFormData>({
    name: '',
    chainId: 0,
    rpcUrl: '',
    explorerUrl: '',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyName: 'Ether',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Refresh networks when dialog opens
  useEffect(() => {
    if (open) {
      setCustomNetworks(getCustomNetworks());
    }
  }, [open]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Network name is required';
    }
    
    if (!formData.chainId || formData.chainId <= 0) {
      errors.chainId = 'Valid chain ID is required';
    }
    
    if (!formData.rpcUrl.trim()) {
      errors.rpcUrl = 'RPC URL is required';
    } else {
      try {
        new URL(formData.rpcUrl);
      } catch {
        errors.rpcUrl = 'Invalid URL format';
      }
    }
    
    if (formData.explorerUrl && formData.explorerUrl.trim()) {
      try {
        new URL(formData.explorerUrl);
      } catch {
        errors.explorerUrl = 'Invalid URL format';
      }
    }
    
    if (!formData.nativeCurrencySymbol.trim()) {
      errors.nativeCurrencySymbol = 'Currency symbol is required';
    }
    
    if (!formData.nativeCurrencyName.trim()) {
      errors.nativeCurrencyName = 'Currency name is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddNetwork = async () => {
    if (!validateForm()) return;
    
    setIsAdding(true);
    
    try {
      const result = addCustomNetwork(formData);
      
      if (result.success) {
        setCustomNetworks(getCustomNetworks());
        setFormData({
          name: '',
          chainId: 0,
          rpcUrl: '',
          explorerUrl: '',
          nativeCurrencySymbol: 'ETH',
          nativeCurrencyName: 'Ether',
        });
        setFormErrors({});
        setIsAddFormOpen(false);
        
        toast({
          title: 'Network Added',
          description: `${formData.name} has been added successfully. Reload the page to connect to it.`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to add network',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveNetwork = async (chainId: number, networkName: string) => {
    try {
      const result = removeCustomNetwork(chainId);
      
      if (result.success) {
        setCustomNetworks(getCustomNetworks());
        toast({
          title: 'Network Removed',
          description: `${networkName} has been removed`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to remove network',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const allNetworks = getAllNetworks();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Networks</DialogTitle>
          <DialogDescription>
            Add custom EVM networks or manage existing ones. Custom networks will be available after page reload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Network Form - Collapsible */}
          <Collapsible open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Custom Network</span>
                </div>
                {isAddFormOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="network-name">Network Name</Label>
                  <Input
                    id="network-name"
                    placeholder="e.g., Polygon Mumbai"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={formErrors.name ? 'border-red-500' : ''}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="chain-id">Chain ID</Label>
                  <Input
                    id="chain-id"
                    type="number"
                    placeholder="e.g., 80001"
                    value={formData.chainId || ''}
                    onChange={(e) => setFormData({ ...formData, chainId: parseInt(e.target.value) || 0 })}
                    className={formErrors.chainId ? 'border-red-500' : ''}
                  />
                  {formErrors.chainId && (
                    <p className="text-sm text-red-500">{formErrors.chainId}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rpc-url">RPC URL</Label>
                <Input
                  id="rpc-url"
                  placeholder="https://rpc-url.com"
                  value={formData.rpcUrl}
                  onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                  className={formErrors.rpcUrl ? 'border-red-500' : ''}
                />
                {formErrors.rpcUrl && (
                  <p className="text-sm text-red-500">{formErrors.rpcUrl}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="explorer-url">Explorer URL (Optional)</Label>
                <Input
                  id="explorer-url"
                  placeholder="https://explorer-url.com"
                  value={formData.explorerUrl}
                  onChange={(e) => setFormData({ ...formData, explorerUrl: e.target.value })}
                  className={formErrors.explorerUrl ? 'border-red-500' : ''}
                />
                {formErrors.explorerUrl && (
                  <p className="text-sm text-red-500">{formErrors.explorerUrl}</p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency-symbol">Currency Symbol</Label>
                  <Input
                    id="currency-symbol"
                    placeholder="e.g., MATIC"
                    value={formData.nativeCurrencySymbol}
                    onChange={(e) => setFormData({ ...formData, nativeCurrencySymbol: e.target.value })}
                    className={formErrors.nativeCurrencySymbol ? 'border-red-500' : ''}
                  />
                  {formErrors.nativeCurrencySymbol && (
                    <p className="text-sm text-red-500">{formErrors.nativeCurrencySymbol}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency-name">Currency Name</Label>
                  <Input
                    id="currency-name"
                    placeholder="e.g., Polygon"
                    value={formData.nativeCurrencyName}
                    onChange={(e) => setFormData({ ...formData, nativeCurrencyName: e.target.value })}
                    className={formErrors.nativeCurrencyName ? 'border-red-500' : ''}
                  />
                  {formErrors.nativeCurrencyName && (
                    <p className="text-sm text-red-500">{formErrors.nativeCurrencyName}</p>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={handleAddNetwork} 
                disabled={isAdding}
                className="w-full"
              >
                {isAdding ? 'Adding...' : 'Add Network'}
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Network List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Available Networks</h3>
            
            <Alert>
              <AlertDescription>
                Custom RPC URLs will be applied after page reload for security reasons.
              </AlertDescription>
            </Alert>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {allNetworks.map((network) => {
                  const isDefault = isDefaultNetwork(network.id);
                  const customNetwork = customNetworks.find(n => n.id === network.id);
                  
                  return (
                    <div
                      key={network.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={isDefault ? 'default' : 'secondary'}>
                          {isDefault ? 'Default' : 'Custom'}
                        </Badge>
                        <div>
                          <div className="font-medium">{network.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Chain ID: {network.id} • {network.nativeCurrency.symbol}
                          </div>
                          {customNetwork && (
                            <div className="text-xs text-muted-foreground">
                              RPC: {customNetwork.rpcUrl}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {network.blockExplorers?.default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(network.blockExplorers!.default!.url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {!isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveNetwork(network.id, network.name)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
