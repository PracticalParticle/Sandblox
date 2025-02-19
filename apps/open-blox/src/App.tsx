import { Routes, Route } from 'react-router-dom'
import { SingleWalletManagerProvider, WalletConnectButton } from "./components/SingleWalletManager";
import { Toaster } from "./components/ui/toaster";

// Layouts
import { MainLayout } from './components/layouts/MainLayout'

// Pages
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { BloxContracts } from './pages/BloxContracts'
import { ContractDetails } from './pages/ContractDetails'
import { Broadcaster } from './pages/Broadcaster'
import { Navbar } from './components/navigation/Navbar'
import { Footer } from './components/navigation/Footer'

const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
if (!WALLET_CONNECT_PROJECT_ID) {
  throw new Error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable');
}

export default function App() {
  return (
    <SingleWalletManagerProvider projectId={WALLET_CONNECT_PROJECT_ID}>
      <MainLayout>
        <div className="flex min-h-screen flex-col">
          <Navbar />

          <main className="flex-1">
            <div className="mx-auto max-w-7xl text-center">
              <WalletConnectButton />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/blox-contracts" element={<BloxContracts />} />
                <Route path="/contracts/:contractId" element={<ContractDetails />} />
                <Route path="/broadcaster" element={<Broadcaster />} />
              </Routes>
            </div>
          </main>

          <Footer />
        </div>
      </MainLayout>
      <Toaster />
    </SingleWalletManagerProvider>
  )
} 