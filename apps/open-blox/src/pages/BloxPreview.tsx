import { useParams } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

export function BloxPreview() {
  const { contractId } = useParams<{ contractId: string }>();
  
  // Dynamically import the preview component using contractId
  const PreviewComponent = lazy(() => {
    return import(`../blox/${contractId}/${contractId}.preview`)
      .catch((error) => {
        console.error(`Failed to load preview for ${contractId}:`, error);
        // Fallback to a mock component if the import fails
        return import('../blox/SimpleVault/SimpleVault.preview');
      });
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="rounded-lg border-2 border-primary/20 overflow-hidden">
          <Suspense fallback={
            <div className="flex items-center justify-center h-[600px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          }>
            <PreviewComponent />
          </Suspense>
        </div>
      </div>
    </div>
  );
} 