import { useState, ReactNode } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export interface FormField<T = string> {
  id: string
  label: string
  placeholder?: string
  description?: string
  type?: string
  min?: number
  max?: number
  defaultValue?: T
  validate?: (value: T) => string | undefined
}

export interface BaseDeploymentFormProps<T extends Record<string, any>> {
  title: string
  description: string
  fields: FormField[]
  onDeploy: (params: T) => Promise<void>
  isLoading?: boolean
  customContent?: ReactNode
}

export function BaseDeploymentForm<T extends Record<string, any>>({ 
  title, 
  description, 
  fields, 
  onDeploy, 
  isLoading,
  customContent
}: BaseDeploymentFormProps<T>) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    fields.forEach(field => {
      initial[field.id] = field.defaultValue?.toString() || ''
    })
    return initial
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      // Validate all fields
      for (const field of fields) {
        const value = formData[field.id]
        if (!value) {
          throw new Error(`${field.label} is required`)
        }
        if (field.validate) {
          const error = field.validate(value)
          if (error) {
            throw new Error(error)
          }
        }
      }

      // Convert form data to expected types
      const params = {} as T
      for (const field of fields) {
        if (field.type === 'number') {
          params[field.id as keyof T] = parseInt(formData[field.id]) as T[keyof T]
        } else {
          params[field.id as keyof T] = formData[field.id] as T[keyof T]
        }
      }

      await onDeploy(params)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input
                id={field.id}
                type={field.type || 'text'}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                value={formData[field.id]}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  [field.id]: e.target.value 
                }))}
              />
              {field.description && (
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
              )}
            </div>
          ))}

          {customContent}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              'Deploy'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
