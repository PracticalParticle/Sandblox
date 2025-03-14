import { Routes, Route } from 'react-router-dom';
import { Toaster } from "./components/ui/toaster";
import { MainLayout } from './components/layouts/MainLayout';
import { TestnetBanner } from './components/ui/TestnetBanner';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { BloxContracts } from './pages/BloxContracts';
import { ContractDetails } from './pages/ContractDetails';
import { SecurityDetails } from './pages/SecurityDetails';
import { Navbar } from './components/navigation/Navbar';
import { Footer } from './components/navigation/Footer';
import BloxMiniApp from './pages/BloxMiniApp';
import Blockchains from './pages/Blockchains';
import BlockchainDetails from './pages/BlockchainDetails';
import Documentation from './pages/Documentation';

export default function App() {
  return (
    <MainLayout>
      <div className="flex flex-col min-h-screen">
        <div className="sticky top-0 z-50">
          <TestnetBanner />
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
              <Route path="/blockchains" element={<Blockchains />} />
              <Route path="/blockchains/:id" element={<BlockchainDetails />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/docs/:slug" element={<Documentation />} />
            </Routes>
          </div>
        </main>
        <footer className="border-t py-6 md:py-0 glass">
          <Footer />
        </footer>
      </div>
      <Toaster />
    </MainLayout>
  );
}