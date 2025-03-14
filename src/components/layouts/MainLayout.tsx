import { ReactNode } from 'react'
import { DeployedContractProvider } from '@/contexts/DeployedContractContext'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background antialiased">
      <DeployedContractProvider>
        {children}
      </DeployedContractProvider>
    </div>
  )
} 