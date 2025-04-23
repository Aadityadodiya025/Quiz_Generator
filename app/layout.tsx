import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { AuthProvider } from "@/components/auth-provider"
import { ClientProviders } from "@/components/client-providers"
import { ErrorBoundary } from "@/components/error-boundary"
import "@/app/globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "QuizGen - Adaptive Quiz Generation Platform",
  description: "Upload. Generate. Quiz Smartly.",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ClientProviders>
            <ErrorBoundary>
              <Navbar />
              <main className="min-h-[calc(100vh-13rem)]">{children}</main>
              <Footer />
            </ErrorBoundary>
          </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  )
}