"use client"

import { useState, useEffect } from "react"
import { UploadSection } from "@/components/upload-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

export default function UploadPage() {
  const [quizGenerated, setQuizGenerated] = useState(false)
  const [quizTitle, setQuizTitle] = useState("")
  const router = useRouter()
  
  useEffect(() => {
    // Check if we have a generated quiz already
    const storedQuiz = sessionStorage.getItem("generatedQuiz")
    if (storedQuiz) {
      try {
        const parsedQuiz = JSON.parse(storedQuiz)
        setQuizGenerated(true)
        setQuizTitle(parsedQuiz.title || "Generated Quiz")
      } catch (error) {
        console.error("Failed to parse quiz data:", error)
      }
    }
  }, [])
  
  const handleStartQuiz = () => {
    // Get quiz from session storage
    const storedQuiz = sessionStorage.getItem("generatedQuiz")
    
    if (storedQuiz) {
      // Save as active quiz with start time
      sessionStorage.setItem("activeQuiz", JSON.stringify({
        ...JSON.parse(storedQuiz),
        startTime: new Date().toISOString()
      }))
      
      // Redirect directly to quiz
      router.push("/quiz")
    }
  }
  
  const handleUploadSuccess = (title: string) => {
    setQuizGenerated(true)
    setQuizTitle(title)
  }

  // Add this function to clear any existing quiz data before generating a new quiz
  const clearExistingQuizData = () => {
    // Clear existing quiz results and active quiz
    sessionStorage.removeItem("quizResults");
    sessionStorage.removeItem("activeQuiz");
    console.log("Cleared existing quiz data");
  }

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Upload Study Material</h1>
        
        {quizGenerated ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quiz Generated Successfully!</CardTitle>
              <CardDescription>Your quiz is ready to take based on the uploaded document.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                <strong>Quiz Title:</strong> {quizTitle}
              </p>
              <p>You can start the quiz now or upload a different document to generate a new quiz.</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setQuizGenerated(false)}>
                Upload New Document
              </Button>
              <Button onClick={handleStartQuiz}>
                Start Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <UploadSection onSuccess={handleUploadSuccess} />
        )}
      </div>
    </div>
  )
}
