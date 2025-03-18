import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Menu, X, Github, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '../ThemeToggle'
import { Link } from 'react-router-dom'
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
    <header className="w-full border-b glass transition-colors duration-300">
      <nav className="container flex h-16 items-center justify-between relative">
        {/* Logo & Desktop Navigation */}
        <div className="flex items-center gap-6">
          <Link
            className="flex items-center gap-2 text-lg font-bold hover-lift"
            to="/"
          >
            <img src="/logo.svg" alt="SandBlox Logo" className="h-8 w-8" />
            <span className="gradient-text tracking-tight">SandBlox</span>
          </Link>
          <div className="hidden md:flex md:items-center md:gap-6">
            {isConnected && (
              <Link
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                to="/dashboard"
              >
                My Blox
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift whitespace-nowrap">
                Explore
                <ChevronDown className="h-4 w-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/blox-contracts">Contracts</Link>
                </DropdownMenuItem>
                {/* <DropdownMenuItem asChild>
                  <Link to="/blockchains">Blockchains</Link>
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
              to="/docs"
            >
              Docs
            </Link>
            <a
              href="https://github.com/PracticalParticle/sand-blox"
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
                <Link
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  My Blox
                </Link>
              )}
              <div className="text-sm font-medium text-muted-foreground">Explore</div>
              <Link
                className="pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                to="/blox-contracts"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contracts
              </Link>
              {/* <Link
                className="pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                to="/blockchains"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Blockchains
              </Link> */}
              <a
                className="pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                href="/bug-hunt"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Bug Hunt
              </a>
              <Link
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover-lift"
                to="/docs"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <a
                href="https://github.com/PracticalParticle/sand-blox"
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