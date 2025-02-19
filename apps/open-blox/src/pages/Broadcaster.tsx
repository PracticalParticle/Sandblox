import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import MetaTxBroadcast from '@/components/MetaTxBroadcast'
import { ArrowRight, ArrowLeft, Send, Radio } from 'lucide-react'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

type WizardStep = {
  title: string
  description: string
}

const WIZARD_STEPS: WizardStep[] = [
  {
    title: 'Connect Wallet',
    description: 'Connect your wallet to broadcast meta transactions',
  },
  {
    title: 'Transaction Details',
    description: 'Enter the details of your meta transaction',
  },
  {
    title: 'Review & Broadcast',
    description: 'Review your transaction and broadcast it',
  },
]

interface MetaTxData {
  to: string
  data: string
  value: string
  nonce: string
}

export function Broadcaster() {
  const [currentStep, setCurrentStep] = useState(0)
  const [metaTxData, setMetaTxData] = useState<MetaTxData>({
    to: '',
    data: '',
    value: '',
    nonce: '',
  })

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <MetaTxBroadcast />
          </div>
        )
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="to">To Address</Label>
                <Input
                  id="to"
                  placeholder="0x..."
                  value={metaTxData.to}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setMetaTxData({ ...metaTxData, to: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Transaction Data</Label>
                <Input
                  id="data"
                  placeholder="0x..."
                  value={metaTxData.data}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setMetaTxData({ ...metaTxData, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value (ETH)</Label>
                <Input
                  id="value"
                  type="number"
                  placeholder="0.0"
                  value={metaTxData.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setMetaTxData({ ...metaTxData, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nonce">Nonce</Label>
                <Input
                  id="nonce"
                  type="number"
                  placeholder="0"
                  value={metaTxData.nonce}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setMetaTxData({ ...metaTxData, nonce: e.target.value })}
                />
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <dl className="divide-y">
                  <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm font-medium leading-6">To Address</dt>
                    <dd className="mt-1 text-sm leading-6 sm:col-span-2 sm:mt-0">
                      {metaTxData.to || 'Not set'}
                    </dd>
                  </div>
                  <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm font-medium leading-6">Transaction Data</dt>
                    <dd className="mt-1 text-sm leading-6 sm:col-span-2 sm:mt-0">
                      {metaTxData.data || 'Not set'}
                    </dd>
                  </div>
                  <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm font-medium leading-6">Value</dt>
                    <dd className="mt-1 text-sm leading-6 sm:col-span-2 sm:mt-0">
                      {metaTxData.value || '0'} ETH
                    </dd>
                  </div>
                  <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm font-medium leading-6">Nonce</dt>
                    <dd className="mt-1 text-sm leading-6 sm:col-span-2 sm:mt-0">
                      {metaTxData.nonce || '0'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Button className="w-full" onClick={() => console.log('Broadcasting...', metaTxData)}>
              <Send className="mr-2 h-4 w-4" />
              Broadcast Transaction
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="container py-8">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meta Transaction Broadcaster</h1>
            <p className="mt-2 text-muted-foreground">
              Broadcast transactions without paying for gas using meta transactions.
            </p>
          </div>
        </motion.div>

        {/* Wizard Steps */}
        <motion.div variants={item} className="space-y-8">
          <div className="flex justify-between">
            {WIZARD_STEPS.map((step, index) => (
              <div
                key={step.title}
                className={`flex-1 ${
                  index !== WIZARD_STEPS.length - 1 ? 'border-b-2' : ''
                } ${
                  index <= currentStep ? 'border-primary' : 'border-muted'
                } pb-4 transition-colors`}
              >
                <div className="flex items-center">
                  <div
                    className={`rounded-full p-2 text-sm font-medium ${
                      index <= currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Step Content */}
          <Card>
            <CardHeader>
              <CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
            </CardHeader>
            <CardContent>{renderStepContent()}</CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentStep === WIZARD_STEPS.length - 1}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
} 