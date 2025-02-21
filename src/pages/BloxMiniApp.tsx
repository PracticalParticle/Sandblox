import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useParams } from 'react-router-dom';
import SimpleVaultUI from '../blox/SimpleVault/SimpleVault.ui';
import { Address } from 'viem';
import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Message {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  timestamp: Date;
}

const BloxMiniApp: React.FC = () => {
  const { type, address } = useParams<{ type: string; address: string }>();
  const [messages, setMessages] = useState<Message[]>([]);

  // Function to add messages that can be called from child components
  const addMessage = (message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [{
      ...message,
      timestamp: new Date()
    }, ...prev]);
  };

  // Render the appropriate Blox UI based on type
  const renderBloxUI = () => {
    if (!type || !address) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">No Blox selected</p>
        </div>
      );
    }

    switch (type) {
      case 'simple-vault':
        return (
          <SimpleVaultUI 
            contractAddress={address as Address}
            contractInfo={{
              address: address as Address,
              type: 'simple-vault',
              name: 'Simple Vault',
              category: 'Storage',
              description: 'A secure vault contract for storing and managing assets with basic access controls.',
              bloxId: 'simple-vault'
            }}
            onError={(error) => {
              addMessage({
                type: 'error',
                title: 'Operation Failed',
                description: error.message || 'Failed to perform operation'
              });
            }}
          />
        );
      default:
        return (
          <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Unknown Blox type: {type}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-bold">Blox Mini Playground</h1>
        <div className="flex items-center space-x-4">
          {/* Add header controls here */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Sidebar - Tools Panel */}
        <Card className="w-64 border-r m-4 rounded-lg shadow-lg">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Tools</h2>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {/* Add tools and controls here */}
            </ScrollArea>
          </div>
        </Card>

        {/* Main Workspace */}
        <div className="flex-1 p-4">
          <Card className="h-full rounded-lg shadow-lg">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {type ? `${type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}` : 'Workspace'}
                {address && <span className="text-sm text-gray-500 ml-2">({address})</span>}
              </h2>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 gap-4">
                {renderBloxUI()}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Properties & Messages */}
        <Card className="w-72 border-l m-4 rounded-lg shadow-lg">
          <div className="flex flex-col h-full">
            {/* Properties Section */}
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold mb-4">Properties</h2>
              <ScrollArea className="h-[calc(50vh-8rem)]">
                {/* Add properties panel content here */}
              </ScrollArea>
            </div>

            {/* Notifications Section */}
            <div className="p-4 flex-1">
              <h2 className="text-lg font-semibold mb-4">Notifications</h2>
              <ScrollArea className="h-[calc(50vh-8rem)]">
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No notifications to display
                    </p>
                  ) : (
                    messages.map((message, index) => (
                      <Alert 
                        key={index} 
                        variant={message.type === 'error' ? 'destructive' : 'default'}
                        className={`text-sm ${
                          message.type === 'warning' ? 'border-yellow-500 text-yellow-700' :
                          message.type === 'success' ? 'border-green-500 text-green-700' :
                          message.type === 'info' ? 'border-blue-500 text-blue-700' : ''
                        }`}
                      >
                        {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
                        {message.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                        {message.type === 'info' && <Info className="h-4 w-4" />}
                        {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
                        <AlertTitle className="text-xs">{message.title}</AlertTitle>
                        <AlertDescription className="text-xs mt-1">
                          {message.description}
                          <div className="text-[10px] mt-1 opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BloxMiniApp; 