"use client"

import * as React from "react"
import { ThemeProvider } from "next-themes"

import { Toaster } from "@/components/ui/sonner"

type ProvidersProps = {
  children: React.ReactNode
}

export function AppProviders({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
