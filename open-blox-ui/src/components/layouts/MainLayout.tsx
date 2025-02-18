import { ReactNode } from 'react'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased transition-colors duration-300">
      <div className="theme-gradient" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
} 