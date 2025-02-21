import { useParams } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getContractDetails } from '../lib/catalog';
import type { BloxContract } from '../lib/catalog/types';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

    const folderName = contract.files.metadata.split('/').slice(-2)[0];
    
    return import(`../blox/${folderName}/${folderName}.preview.tsx`)
      .catch((error) => {
        console.error(`Failed to load preview for ${contractId}:`, error);
        throw error;
      });
  });

  if (error) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center justify-between p-6 border-b">
          <h1 className="text-2xl font-bold">Contract Preview Error</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <p className="text-lg font-semibold">Failed to load preview</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-bold">Contract Preview: {contract?.name || 'Loading...'}</h1>
        <div className="flex items-center space-x-4">
          {/* Add header controls here */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Sidebar - Contract Info */}
        <Card className="w-64 border-r m-4 rounded-lg shadow-lg">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Contract Info</h2>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {contract && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
                    <p className="text-sm">{contract.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
                    <p className="text-sm">{contract.category}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Security Level</h3>
                    <p className="text-sm">{contract.securityLevel}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                    <p className="text-sm">{contract.description}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Features</h3>
                    <ul className="text-sm list-disc list-inside">
                      {contract.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>

        {/* Main Workspace */}
        <div className="flex-1 p-4">
          <Card className="h-full rounded-lg shadow-lg">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Preview</h2>
              <Separator className="my-4" />
              <div className="min-h-[600px]">
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
          </Card>
        </div>

        {/* Right Sidebar - Properties Panel */}
        <Card className="w-72 border-l m-4 rounded-lg shadow-lg">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Requirements</h2>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {contract && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Requirements</h3>
                    <ul className="text-sm list-disc list-inside">
                      {contract.requirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Deployments</h3>
                    <p className="text-sm">{contract.deployments}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Last Updated</h3>
                    <p className="text-sm">{new Date(contract.lastUpdated).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>
      </div>

      {/* Footer Status Bar */}
      <div className="border-t p-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>Status: {contract ? 'Contract Loaded' : 'Loading...'}</div>
          <div>Contract ID: {contractId}</div>
        </div>
      </div>
    </div>
  );
} 