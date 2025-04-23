"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useState } from "react"
import { SignupModal } from "@/components/signup-modal"

export function CTASection() {
  const router = useRouter()
  const { data } = useAuth()
  const [isSignupOpen, setIsSignupOpen] = useState(false)

  const handleGetStarted = () => {
    if (data?.user) {
      router.push("/upload")
    } else {
      setIsSignupOpen(true)
    }
  }

  return (
    <div className="container py-16">
      <div className="rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 p-8 md:p-16 text-white text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to Transform Your Learning?</h2>
        <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto opacity-90">
          Join thousands of students and educators who are using QuizGen to create personalized quizzes and improve
          learning outcomes.
        </p>
        <Button size="lg" variant="secondary" onClick={handleGetStarted}>
          Get Started for Free
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </div>
  )
}
