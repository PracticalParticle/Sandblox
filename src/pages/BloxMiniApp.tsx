import React from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const BloxMiniApp: React.FC = () => {
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
              <h2 className="text-xl font-semibold mb-4">Workspace</h2>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 gap-4">
                {/* Add blox workspace components here */}
                <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Blox UI will be displayed here</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Properties Panel */}
        <Card className="w-72 border-l m-4 rounded-lg shadow-lg">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Properties</h2>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {/* Add properties panel content here */}
            </ScrollArea>
          </div>
        </Card>
      </div>

      {/* Footer Status Bar */}
      <div className="border-t p-2 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>Status: Ready</div>
          <div>Blox Version: 1.0.0</div>
        </div>
      </div>
    </div>
  );
};

export default BloxMiniApp; 