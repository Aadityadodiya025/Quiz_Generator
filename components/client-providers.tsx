'use client'

import React from 'react'
import { ReduxProvider } from '@/store/provider'
import { store } from '@/store/store'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'

export function ClientProviders({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ReduxWrapper>
        {children}
        <Toaster />
      </ReduxWrapper>
    </ThemeProvider>
  )
}

// Separate component to avoid passing functions directly from server to client components
function ReduxWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      {children}
    </ReduxProvider>
  )
} 