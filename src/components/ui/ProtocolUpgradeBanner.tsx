import { useState } from 'react';
import { Zap, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProtocolUpgradeBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white py-3 z-[9999] relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-indigo-600/20 animate-pulse"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-center justify-center gap-x-3 text-sm font-medium">
          <div className="flex items-center gap-x-2">
            <Zap className="h-5 w-5 text-yellow-300 animate-pulse" />
            <span className="font-bold text-lg">🚀 Upgraded Bloxchain Protocol Coming Soon!</span>
          </div>
          <div className="hidden sm:flex items-center gap-x-4 text-sm">
            <span className="text-blue-100">
              Enhanced security • Improved performance • New features
            </span>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200"
              onClick={() => window.open('https://github.com/PracticalParticle/Bloxchain-Protocol', '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Learn More
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 ml-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Mobile version */}
        <div className="sm:hidden mt-2 flex flex-col items-center gap-2">
          <span className="text-blue-100 text-xs text-center">
            Enhanced security • Improved performance • New features
          </span>
          <Button
            size="sm"
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200 text-xs"
            onClick={() => window.open('https://github.com/PracticalParticle/Bloxchain-Protocol', '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Learn More
          </Button>
        </div>
      </div>
    </div>
  );
}
