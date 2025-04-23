"use client"

import { Loader2 } from "lucide-react"

interface LoadingProps {
  text?: string
  size?: "sm" | "md" | "lg"
  fullPage?: boolean
}

export function Loading({ 
  text = "Loading...", 
  size = "md", 
  fullPage = false 
}: LoadingProps) {
  const sizeMap = {
    sm: { spinner: "h-4 w-4", text: "text-sm" },
    md: { spinner: "h-6 w-6", text: "text-base" },
    lg: { spinner: "h-10 w-10", text: "text-lg" }
  }

  const content = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <Loader2 className={`${sizeMap[size].spinner} animate-spin text-primary`} />
      {text && <p className={`${sizeMap[size].text} text-muted-foreground`}>{text}</p>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        {content}
      </div>
    )
  }

  return content
} 