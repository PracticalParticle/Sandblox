import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Menu, X, Github, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '../ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Navbar() {
  const { isConnected } = useAccount()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b glass transition-colors duration-300">
      <nav className="container flex h-16 items-center justify-between relative">
        {/* Logo & Desktop Navigation */}
        <div className="flex items-center gap-6">
          <a
            className="flex items-center gap-2 text-lg font-bold hover-lift"
            href="/"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/50 text-primary-foreground">
              OB
            </div>
            <span className="hidden sm:inline-block bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold">SandBlox</span>
          </a>
          <div className="hidden md:flex md:items-center md:gap-6">
            {isConnected && (
              <a
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/dashboard"
              >
                My Blox
              </a>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift">
                Explore
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <a href="/blox-contracts">Contracts</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/blockchains">Blockchains</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/bug-hunt">Bug Hunt</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <a
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
              href="/docs"
            >
              Docs
            </a>
            <a
              href="https://github.com/particlecs-com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground glow-primary"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Right side items - reorganized */}
        <div className="flex items-center gap-2">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
          />
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-lg p-2 hover:bg-accent md:hidden"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu - Updated positioning */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ left: '-100%' }}
            animate={{ left: '0' }}
            exit={{ left: '-100%' }}
            className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}
          >
            <div className="container flex flex-col space-y-4 py-4">
              {isConnected && (
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  My Blox
                </a>
              )}
              <div className="text-sm font-medium text-muted-foreground">Explore</div>
              <a
                className="pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/blox-contracts"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contracts
              </a>
              <a
                className="pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/blockchains"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Blockchains
              </a>
              <a
                className="pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/bug-hunt"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Bug Hunt
              </a>
              <a
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/docs"
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