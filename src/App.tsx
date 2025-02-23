import { Routes, Route } from 'react-router-dom'
import { Toaster } from "./components/ui/toaster";

// Layouts
import { MainLayout } from './components/layouts/MainLayout'

// Pages
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { BloxContracts } from './pages/BloxContracts'
import { ContractDetails } from './pages/ContractDetails'
import SecurityCenter from './pages/SecurityCenter'
import { SecurityDetails } from './pages/SecurityDetails'
import { Navbar } from './components/navigation/Navbar'
import { Footer } from './components/navigation/Footer'
import BloxMiniApp from './pages/BloxMiniApp'
import Blockchains from './pages/Blockchains'
import BlockchainDetails from './pages/BlockchainDetails'

export default function App() {
  return (
    <MainLayout>
      <div className="flex min-h-screen flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="mx-auto max-w-7xl text-center">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/blox-contracts" element={<BloxContracts />} />
              <Route path="/contracts/:contractId" element={<ContractDetails />} />
              <Route path="/security-center" element={<SecurityCenter />} />
              <Route path="/security-center/:address" element={<SecurityDetails />} />
              <Route path="/blox/:type/:address" element={<BloxMiniApp />} />
              <Route path="/blockchains" element={<Blockchains />} />
              <Route path="/blockchains/:id" element={<BlockchainDetails />} />
            </Routes>
          </div>
        </main>

        <Footer />
      </div>
      <Toaster />
    </MainLayout>
  )
} 