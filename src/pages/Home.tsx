import { motion } from 'framer-motion'
import { ArrowRight, Shield, Zap, Code2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'

export function Home() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()

  return (
    <div className="relative">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 " />
    
        
        <div className="container relative">
          <div className="mx-auto max-w-4xl pt-16 sm:pt-24">
            <div className="text-center">
              <motion.h1 
                className="text-4xl font-bold tracking-tight sm:text-6xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="gradient-text">SandBlox</span>
                <br />
                <span className="mt-4 block text-2xl sm:text-4xl">
                  Build Secure Smart Contract Systems
                </span>
              </motion.h1>
              <motion.p 
                className="mt-6 text-lg leading-8 text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Create, deploy, and manage secure smart contract systems with our modular building blocks. 
                Powered by Particle CS's account abstraction infrastructure.
              </motion.p>
              <motion.div 
                className="mt-10 flex items-center justify-center gap-x-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <button
                  onClick={() => navigate('/blox-contracts')}
                  className="gradient-border group inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold leading-6 text-foreground transition duration-150 hover:text-primary"
                >
                  <span>Explore Contracts</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                {isConnected && (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="text-sm font-semibold leading-6 text-muted-foreground hover:text-foreground"
                  >
                    Go to Dashboard <span aria-hidden="true">→</span>
                  </button>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <motion.div 
              className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative space-y-2">
                <Shield className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Secure by Design</h3>
                <p className="text-sm text-muted-foreground">
                  Built with security-first principles and audited components for robust smart contract systems.
                </p>
              </div>
            </motion.div>

            <motion.div 
              className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="relative space-y-2">
                <Code2 className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Modular Blocks</h3>
                <p className="text-sm text-muted-foreground">
                  Composable smart contract building blocks for flexible and extensible systems.
                </p>
              </div>
            </motion.div>

            <motion.div 
              className="gradient-border relative overflow-hidden rounded-lg p-6 bg-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="relative space-y-2">
                <Zap className="h-10 w-10 text-primary" />
                <h3 className="text-xl font-bold">Easy Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Seamlessly integrate with Particle CS's account abstraction infrastructure.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
} 