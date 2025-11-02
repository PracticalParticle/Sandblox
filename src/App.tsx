import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "./components/ui/toaster";
import { MainLayout } from './components/layouts/MainLayout';
import { ProtocolUpgradeBanner } from './components/ui/ProtocolUpgradeBanner';
import { TestnetBanner } from './components/ui/TestnetBanner';
import { NetworkCSPBanner } from './components/ui/NetworkCSPBanner';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { BloxContracts } from './pages/BloxContracts';
import { ContractDetails } from './pages/ContractDetails';
import { SecurityDetails } from './pages/SecurityDetails';
import { Navbar } from './components/navigation/Navbar';
import { Footer } from './components/navigation/Footer';
import BloxMiniApp from './pages/BloxMiniApp';
import Documentation from './pages/Documentation';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { DevDebugPanel } from './components/DevDebugPanel';

// Create a client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <div className="flex flex-col min-h-screen">
          <div className="sticky top-0 z-50">
            <ProtocolUpgradeBanner />
            <TestnetBanner />
            <NetworkCSPBanner />
            <Navbar />
          </div>
          <main className="flex-1 flex flex-col">
            <div className="mx-auto w-full  flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/blox-contracts" element={<BloxContracts />} />
                <Route path="/contracts/:contractId" element={<ContractDetails />} />
                <Route path="/blox-security/:address" element={<SecurityDetails />} />
                <Route path="/blox/:type/:address" element={<BloxMiniApp />} />
                <Route path="/docs" element={<Documentation />} />
                <Route path="/docs/:slug" element={<Documentation />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
              </Routes>
            </div>
          </main>
          <footer className="border-t py-6 md:py-0 glass">
            <Footer />
          </footer>
        </div>
        <Toaster />
        <DevDebugPanel />
      </MainLayout>
    </QueryClientProvider>
  );
}