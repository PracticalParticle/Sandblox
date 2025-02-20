import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Menu, X, Github } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '../ThemeToggle'

export function Navbar() {
  const { isConnected } = useAccount()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b glass transition-colors duration-300">
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
        />
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
      </div>
      <nav className="container flex h-16 items-center">
        {/* Logo & Desktop Navigation */}
        <div className="flex items-center gap-6">
          <a
            className="flex items-center gap-2 text-lg font-bold hover-lift"
            href="/"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/50 text-primary-foreground">
              OB
            </div>
            <span className="hidden sm:inline-block bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold">OpenBlox</span>
          </a>
          <div className="hidden md:flex md:items-center md:gap-6">
            <a
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
              href="/blox-contracts"
            >
              Contracts
            </a>
            {isConnected && (
              <>
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                  href="/dashboard"
                >
                  Dashboard
                </a>
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                  href="/security-center"
                >
                  Security Center
                </a>
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                  href="/broadcaster"
                >
                  Broadcaster
                </a>
              </>
            )}
            <a
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
              href="https://docs.particlecs.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </a>
          </div>
        </div>

        {/* Right side icons */}
        <div className="ml-auto flex items-center gap-4">
          <a
            href="https://github.com/particlecs-com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground glow-primary"
          >
            <Github className="h-5 w-5" />
          </a>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-lg p-2 hover:bg-accent md:hidden hover-lift"
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
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/blox-contracts"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contracts
              </a>
              {isConnected && (
                <>
                  <a
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                    href="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </a>
                  <a
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                    href="/security-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Security Center
                  </a>
                  <a
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                    href="/broadcaster"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Broadcaster
                  </a>
                </>
              )}
              <a
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="https://docs.particlecs.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Docs
              </a>
              <a
                href="https://github.com/particlecs-com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Github className="h-5 w-5" />
                GitHub
              </a>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ThemeToggle />
                <span>Theme</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
} 