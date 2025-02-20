import { useParams } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getContractDetails } from '../lib/catalog';
import type { BloxContract } from '../lib/catalog/types';

export function BloxPreview() {
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<BloxContract | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (contractId) {
      getContractDetails(contractId)
        .then(setContract)
        .catch(error => {
          console.error(`Failed to load contract details for ${contractId}:`, error);
          setError(error);
        });
    }
  }, [contractId]);
  
  // Dynamically import the preview component using contract folder name
  const PreviewComponent = lazy(() => {
    if (!contract) {
      return Promise.reject(new Error('Contract not found'));
    }

    // Extract folder name from the metadata file path
    // e.g., "/src/blox/SimpleVault/SimpleVault.blox.json" -> "SimpleVault"
    const folderName = contract.files.metadata.split('/').slice(-2)[0];
    
    return import(`../blox/${folderName}/${folderName}.preview.tsx`)
      .catch((error) => {
        console.error(`Failed to load preview for ${contractId}:`, error);
        throw error;
      });
  });

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-[600px]">
            <div className="flex flex-col items-center gap-2 text-destructive">
              <p className="text-lg font-semibold">Failed to load preview</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            {contract && <PreviewComponent />}
          </Suspense>
        </div>
      </div>
    </div>
  );
} 