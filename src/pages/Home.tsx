import { motion } from 'framer-motion'
import { 
  ArrowRight, Zap, Github, BookOpen, Blocks, 
  Wallet, Terminal, Library, Lock, TestTube, Users, X,
  Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'

const SANDBLOX_COLOR = '#3b82f6' // You can adjust this color as needed

export function Home() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()

  return (
    <div className="relative">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        </div>
        
        <div className="container relative z-10">
          <div className="hero-content mx-auto max-w-4xl">
            <div className="hero-title text-center">
              <motion.h1 
                className="text-4xl font-bold  sm:text-6xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="gradient-text tracking-tight">SandBlox</span>
                <br />
                <span className="mt-6 block text-2xl sm:text-4xl">
                  Building blocks for Web3
                </span>
                <span className="mt-4 block text-xl sm:text-2xl font-medium text-muted-foreground">
                  Development toolkit for blockchain applications
                </span>
              </motion.h1>
              
              <motion.p 
                className="mt-8 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                A community-driven platform for building and managing secure blockchain applications.
                Powered by Particle CS's account abstraction infrastructure and backed by the Web3 community.
              </motion.p>
            </div>
              
            <motion.div 
              className="hero-features mt-12 flex flex-wrap justify-center gap-3 sm:gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="feature-chip">
                <Library className="h-4 w-4 text-primary" />
                Application Library
              </div>
              <div className="feature-chip">
                <Lock className="h-4 w-4 text-primary" />
                Custom Security Policies
              </div>
              <div className="feature-chip">
                <TestTube className="h-4 w-4 text-primary" />
                Real-World Testing
              </div>
              <div className="feature-chip">
                <Users className="h-4 w-4 text-primary" />
                Community Audits
              </div>
            </motion.div>
              
            <motion.div 
              className="hero-cta mt-12 flex flex-wrap justify-center gap-3 sm:gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
            
              <Button 
              size="lg" 
              aria-label="chat with AI"
              className="hero-gradient-button"

              onClick={() => window.open('https://www.perplexity.ai/search/you-are-particle-crypto-securi-.8Y9s72dQpmAF_i4bHjXxA', '_blank')}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Chat with AI
              
            </Button>
              
              {isConnected && (
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  size="lg"
                  className="hero-outline-button"
                >
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <div className="container py-16">
        <motion.div 
          className="mx-auto max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-center mb-4">Core Capabilities</h2>
          <p className="text-lg md:text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">        
            SandBlox provides a comprehensive platform for building and integrating blockchain solutions.
          </p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card">
              <div className="relative space-y-2">
                <Library className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Application Library</h3>
                <p className="text-sm text-muted-foreground">
                  Our library provides secure open source code, and can be built into Particle AA based applications.
                </p>
              </div>
            </div>

            <div className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card">
              <div className="relative space-y-2">
                <Lock className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Custom Security Policies</h3>
                <p className="text-sm text-muted-foreground">
                  You can implement and test new custom security policies.
                </p>
              </div>
            </div>

            <div className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card">
              <div className="relative space-y-2">
                <TestTube className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Real-World Testing</h3>
                <p className="text-sm text-muted-foreground">
                  For real-world testing and security.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 mt-8">
            <div className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card">
              <div className="relative space-y-2">
                <Users className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Community Audits</h3>
                <p className="text-sm text-muted-foreground">
                  Transparency with community driven audits.
                </p>
              </div>
            </div>
            
            <div className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card">
              <div className="relative space-y-2">
                <Blocks className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Modular Architecture</h3>
                <p className="text-sm text-muted-foreground">
                  Self-contained blox with smart contracts, TypeScript SDK, and React components. Easy to extend and customize.
                </p>
              </div>
            </div>

            <div className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card">
              <div className="relative space-y-2">
                <Zap className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Account Abstraction</h3>
                <p className="text-sm text-muted-foreground">
                  Built on Particle CS infrastructure with meta-transactions, batched operations, and gas optimization.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
 {/* Getting Started Section */}
 <div className="container py-16">
        <motion.div 
          className="mx-auto max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-center mb-4">Get Started</h2>
          <p className="text-lg md:text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">        
            Start with SandBlox and build your own blockchain applications faster.
          </p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="gradient-border relative overflow-hidden rounded-lg p-8 bg-card hover:bg-card/80 transition-colors cursor-pointer" onClick={() => navigate('/blox-contracts')}>
              <div className="relative space-y-4">
                <Wallet className="h-12 w-12 text-primary" />
                <h3 className="text-2xl font-bold">Quick Start</h3>
                <p className="text-muted-foreground">
                  Connect your wallet to instantly deploy or import contracts. Manage security settings, funds, and transactions through our intuitive interface.
                </p>
                <div className="flex items-center text-primary">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </div>
            </div>

            <div className="gradient-border relative overflow-hidden rounded-lg p-8 bg-card hover:bg-card/80 transition-colors cursor-pointer" onClick={() => window.open('https://github.com/yourusername/sandblox', '_blank')}>
              <div className="relative space-y-4">
                <Terminal className="h-12 w-12 text-primary" />
                <h3 className="text-2xl font-bold">Developer Mode</h3>
                <p className="text-muted-foreground">
                  Clone the repository to customize and extend the platform. Build your own blox, contribute to the ecosystem, and integrate with your dApps.
                </p>
                <div className="flex items-center text-primary">
                  <span>View Documentation</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Technical Details Section */}
      <div className="container pt-24">
        <motion.div 
          className="mb-32 relative overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          
          
          <div className="text-center ">
            
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Technical Specifications</h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              SandBlox is built with modern technologies and designed for maximum flexibility and performance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="gradient-border relative overflow-hidden rounded-lg p-8 bg-card hover:bg-card/80 transition-colors cursor-pointer"
              >
          
              
              <h3 className="text-xl font-semibold mb-6" style={{ color: SANDBLOX_COLOR }}>Development Stack</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SANDBLOX_COLOR }} />
                  <div>
                    <span className="font-medium block mb-1">Languages & Frameworks</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">TypeScript, Solidity, Rust, React, Node.js</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SANDBLOX_COLOR }} />
                  <div>
                    <span className="font-medium block mb-1">Blockchain Support</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Ethereum, Polygon, Solana, Avalanche, BSC</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SANDBLOX_COLOR }} />
                  <div>
                    <span className="font-medium block mb-1">Development Tools</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">CLI, SDK, API, Documentation, Templates</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="gradient-border relative overflow-hidden rounded-lg p-8 bg-card hover:bg-card/80 transition-colors cursor-pointer" >
          
              
              <h3 className="text-xl font-semibold mb-6" style={{ color: SANDBLOX_COLOR }}>Architecture & Performance</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SANDBLOX_COLOR }} />
                  <div>
                    <span className="font-medium block mb-1">Storage Architecture</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Decoupled storage with IPFS integration and optional centralized fallback</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SANDBLOX_COLOR }} />
                  <div>
                    <span className="font-medium block mb-1">Security Features</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Particle AA integration, multi-sig support, audit tools</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SANDBLOX_COLOR }} />
                  <div>
                    <span className="font-medium block mb-1">Scalability</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Horizontal scaling with load balancing and caching</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main CTA Section */}
      <div className="container py-24 relative">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        
        <motion.div 
          className="relative mx-auto max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-card/30 backdrop-blur-sm gradient-border p-12 rounded-2xl">
            <div className="text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/50">
                Ready to Build with{' '}
                <span className="gradient-text">SandBlox?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Start developing secure blockchain applications today with our blockchain building blox.
              </p>
              
              {/* Primary Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                <Button
                  onClick={() => navigate('/blox-contracts')}
                  size="lg"
                  className="hero-gradient-button w-full sm:w-auto"
                >
                  <Wallet className="h-5 w-5 mr-2" />
                  Launch App
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                
                <Button
                  onClick={() => window.open('https://github.com/yourusername/sandblox', '_blank')}
                  variant="outline"
                  size="lg"
                  className="hero-outline-button w-full sm:w-auto"
                >
                  <Github className="h-5 w-5 mr-2" />
                  View on GitHub
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Community Section */}
      <div className="container py-24 relative">
        <motion.div 
          className="relative mx-auto max-w-6xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Join Our Community
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Become part of a growing network of blockchain innovators. Contribute code, 
                participate in security audits, and help shape the future of Web3 development.
              </p>
              
              {/* Community Benefits */}
              <div className="space-y-6">
                <div className="bg-card/40 backdrop-blur-sm rounded-lg p-6">
                  <h4 className="font-bold text-lg mb-2 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-primary" />
                    Collaborative Development
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Work alongside experienced blockchain developers and security researchers to build 
                    robust, secure applications with real-world impact.
                  </p>
                </div>
                
                <div className="bg-card/40 backdrop-blur-sm rounded-lg p-6">
                  <h4 className="font-bold text-lg mb-2 flex items-center">
                    <BookOpen className="h-5 w-5 mr-2 text-primary" />
                    Knowledge Sharing
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Access resources, tutorials, and best practices from industry experts. 
                    Participate in workshops and technical discussions.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - CTA */}
            <div className="flex flex-col items-center justify-center bg-card/30 backdrop-blur-sm p-12 rounded-2xl gradient-border">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-4">Stay Connected</h3>
                <p className="text-muted-foreground">
                  Join our community and start building the future of Web3
                </p>
              </div>
              
              <Button
                asChild
                size="lg"
                className="hero-gradient-button w-full sm:w-auto"
              >
                <a
                  href="https://x.com/Particle_CS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <X className="h-5 w-5" />
                  <span>Join Our Community</span>
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}