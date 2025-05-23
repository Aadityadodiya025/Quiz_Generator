"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Upload, ArrowRightCircle, Sparkles } from "lucide-react"
import { LoginModal } from "@/components/login-modal"
import { SignupModal } from "@/components/signup-modal"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"

export function HeroSection() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const handleLoginModal = () => {
      setIsSignupOpen(false)
      // Here you would open the login modal
      // For now, we'll just redirect to the login page
      router.push('/login')
    }

    window.addEventListener('openLoginModal', handleLoginModal)
    return () => window.removeEventListener('openLoginModal', handleLoginModal)
  }, [router])

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push("/quiz")
    } else {
      const event = new CustomEvent("openSignupModal")
      window.dispatchEvent(event)
    }
  }

  const handleGenerateSummary = () => {
    router.push("/summary")
  }

  const handleStartQuiz = () => {
    setIsAnimating(true)
    setTimeout(() => {
      if (isAuthenticated) {
        router.push("/upload")
      } else {
        setIsSignupOpen(true)
      }
    }, 1000)
  }

  const handleSignupClose = () => {
    setIsSignupOpen(false)
    setIsAnimating(false)
  }

  return (
    <div className="relative w-full">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background z-0" />

      <div className="container relative z-10 flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 max-w-3xl">
          <span className="inline-block hover:scale-110 transition-transform duration-300 cursor-pointer">Upload</span>
          <span className="mx-2">.</span>
          <span className="inline-block hover:scale-110 transition-transform duration-300 cursor-pointer">Generate</span>
          <span className="mx-2">.</span>
          <span className="inline-block hover:scale-110 transition-transform duration-300 cursor-pointer">Quiz</span>
          {" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-500">Smartly.</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
          Transform your study materials into interactive quizzes in seconds. Upload your documents and let our AI do
          the rest.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={handleGetStarted}>
            Generate Quiz
          </Button>
          <Button size="lg" variant="outline" onClick={handleGenerateSummary}>
            Generate Summary
          </Button>
        </div>

        <div className="mt-16 relative w-full max-w-4xl mx-auto">
          <div className="aspect-video rounded-lg overflow-hidden border shadow-xl bg-card">
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-medium mb-2">Upload your documents</h3>
                <p className="text-muted-foreground">PDF, TXT, and more supported formats</p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-card rounded-lg border shadow-lg p-4 w-full max-w-md">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Quiz Generated!</h4>
                <p className="text-sm text-muted-foreground">15 questions from your document</p>
              </div>
              <div className="flex items-center gap-x-6 mt-4">
                <Button
                  size="lg"
                  className="group relative overflow-hidden"
                  onClick={handleStartQuiz}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 group-hover:opacity-100 opacity-0 transition-opacity duration-300" />
                  <span className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/20 group-hover:opacity-100 opacity-0 transition-opacity duration-300" />
                  <span className="relative flex items-center gap-2">
                    Start Quiz
                    <ArrowRightCircle
                      className={`h-5 w-5 transition-all duration-300 ${
                        isAnimating ? "animate-spin" : "group-hover:translate-x-1"
                      }`}
                    />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <SignupModal isOpen={isSignupOpen} onClose={handleSignupClose} />
    </div>
  )
}
