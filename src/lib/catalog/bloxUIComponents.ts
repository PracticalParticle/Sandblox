import { lazy } from 'react'
import type { BloxContract } from './types'
import { getContractDetails, getAllContracts } from './index'

// Type for the UI component props
export interface BloxUIProps {
  contractAddress: `0x${string}`
  contractInfo: {
    address: `0x${string}`
    type: string
    name: string
    category: string
    description: string
    bloxId: string
  }
  onError?: (error: Error) => void
  _mock?: any
  dashboardMode?: boolean
  renderSidebar?: boolean
}

// Type for the sidebar component props
export interface BloxSidebarProps {
  contractAddress: `0x${string}`
  contractInfo: BloxUIProps['contractInfo']
  onError?: (error: Error) => void
}

// Type definition for the UI components map
export type BloxUIComponents = Record<string, React.LazyExoticComponent<React.ComponentType<BloxUIProps>>>

// Create a map to store all UI components
let uiComponents: BloxUIComponents = {}

// Function to initialize the UI components map
export async function initializeUIComponents(): Promise<BloxUIComponents> {
  try {
    // If components are already initialized, return them
    if (Object.keys(uiComponents).length > 0) {
      return uiComponents;
    }

    const contracts = await getAllContracts()
    
    // Create lazy-loaded components for each contract
    contracts.forEach((contract) => {
      const folderName = contract.files.component.split('/').slice(-2)[0]
      uiComponents[contract.id] = lazy(() => 
        import(`@/blox/${folderName}/${folderName}.ui.tsx`)
          .then(module => {
            if (!module.default) {
              throw new Error(`No default export found for ${contract.id} UI component`)
            }
            return { default: module.default }
          })
          .catch(error => {
            console.error(`Failed to load UI component for ${contract.id}:`, error)
            throw error
          })
      )
    })

    return uiComponents
  } catch (error) {
    console.error('Failed to initialize UI components:', error)
    return {}
  }
}

// Function to get a specific UI component
export function getUIComponent(bloxId: string): React.LazyExoticComponent<React.ComponentType<BloxUIProps>> | null {
  return uiComponents[bloxId] || null
}

// Export the components map
export { uiComponents as default } 