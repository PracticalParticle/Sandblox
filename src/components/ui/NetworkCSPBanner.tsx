import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getCustomRpcUrls } from '@/lib/networkStorage';

export function NetworkCSPBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // Check if there are custom RPC URLs that need CSP update
    const customRpcUrls = getCustomRpcUrls();
    const hasCustomRpc = customRpcUrls.length > 0;
    
    // Check if we've already shown the banner for these RPCs
    const bannerKey = `csp-banner-shown-${customRpcUrls.join(',')}`;
    const hasShownBanner = localStorage.getItem(bannerKey);
    
    setShowBanner(hasCustomRpc && !hasShownBanner);
  }, []);

  const handleReload = () => {
    setIsReloading(true);
    // Mark banner as shown for current RPCs
    const customRpcUrls = getCustomRpcUrls();
    const bannerKey = `csp-banner-shown-${customRpcUrls.join(',')}`;
    localStorage.setItem(bannerKey, 'true');
    
    // Reload the page
    window.location.reload();
  };

  const handleDismiss = () => {
    const customRpcUrls = getCustomRpcUrls();
    const bannerKey = `csp-banner-shown-${customRpcUrls.join(',')}`;
    localStorage.setItem(bannerKey, 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="w-full border-b bg-yellow-50 dark:bg-yellow-900/20">
      <div className="container mx-auto px-4 py-3">
        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1">
              <span className="font-medium text-yellow-800 dark:text-yellow-200">
                Custom networks added!
              </span>
              <span className="text-yellow-700 dark:text-yellow-300 ml-2">
                Reload the page to connect to your custom networks.
              </span>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleReload}
                disabled={isReloading}
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200 dark:hover:bg-yellow-800/30"
              >
                {isReloading ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Reloading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reload Page
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-yellow-600 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-800/30"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
