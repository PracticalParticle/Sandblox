import { Routes, Route } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Menu, X, Github } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Layouts
import { MainLayout } from './components/layouts/MainLayout'

// Pages
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { BloxContracts } from './pages/BloxContracts'
import { ContractDetails } from './pages/ContractDetails'

export default function App() {
  const { isConnected } = useAccount()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <MainLayout>
      <div className="flex min-h-screen flex-col">
        {/* Fixed Connect Wallet Button */}
        <div className="fixed right-4 top-4 z-50">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
          />
        </div>

        <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav className="container flex h-16 items-center justify-between">
            {/* Logo & Desktop Navigation */}
            <div className="flex items-center gap-6">
              <a
                className="flex items-center gap-2 text-lg font-bold"
                href="/"
              >
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
                  OB
                </div>
                <span className="hidden sm:inline-block gradient-text">OpenBlox</span>
              </a>
              <div className="hidden md:flex md:items-center md:gap-6">
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  href="/blox-contracts"
                >
                  Contracts
                </a>
                {isConnected && (
                  <a
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    href="/dashboard"
                  >
                    Dashboard
                  </a>
                )}
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  href="https://docs.particle.network"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Docs
                </a>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/particle-network"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-lg p-2 hover:bg-accent md:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t glass md:hidden"
              >
                <div className="container flex flex-col space-y-4 py-4">
                  <a
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    href="/blox-contracts"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Contracts
                  </a>
                  {isConnected && (
                    <a
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      href="/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Dashboard
                    </a>
                  )}
                  <a
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    href="https://docs.particle.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Docs
                  </a>
                  <a
                    href="https://github.com/particle-network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Github className="h-5 w-5" />
                    GitHub
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="flex-1 bg-gradient-to-b from-background via-background/80 to-background">
          <div className="mx-auto max-w-7xl text-center">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/blox-contracts" element={<BloxContracts />} />
              <Route path="/contracts/:contractId" element={<ContractDetails />} />
            </Routes>
          </div>
        </main>

        <footer className="border-t py-6 md:py-0 glass">
          <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
            <p className="text-center text-sm text-muted-foreground">
              Built with ❤️ by{' '}
              <a
                href="https://particle.network"
                target="_blank"
                rel="noreferrer"
                className="font-medium gradient-text hover:text-foreground"
              >
                Particle Network
              </a>
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://twitter.com/ParticleNtwrk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Twitter
              </a>
              <a
                href="https://discord.gg/particle"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Discord
              </a>
              <a
                href="https://docs.particle.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Documentation
              </a>
            </div>
          </div>
        </footer>
      </div>
    </MainLayout>
  )
} 