"use client"

import { useState, useEffect } from "react"
import { UploadSection } from "@/components/upload-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { clearYouTubeData, clearQuizData } from "@/utils/clear-storage"

// Simple fallback component for errors
function ErrorFallback({ error }: { error?: Error }) {
  const router = useRouter();
  
  const handleReset = () => {
    // Clear any session data that might be causing the error
    clearYouTubeData();
    
    // Refresh the page
    router.refresh();
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
        <CardDescription>There was an error loading the upload section</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message || "An unexpected error occurred"}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-4">
        <Button 
          variant="outline" 
          onClick={handleReset}
        >
          Try again
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function UploadPage() {
  const [quizGenerated, setQuizGenerated] = useState(false)
  const [quizTitle, setQuizTitle] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  // Force 'pdf' as default tab if coming from navbar (no tab param)
  const defaultTab = searchParams.has('tab') ? searchParams.get('tab') || 'pdf' : 'pdf'
  
  useEffect(() => {
    // Check if we have a generated quiz already
    try {
      const storedQuiz = sessionStorage.getItem("generatedQuiz")
      if (storedQuiz && storedQuiz !== "undefined" && storedQuiz !== "null") {
        const parsedQuiz = JSON.parse(storedQuiz)
        if (parsedQuiz && parsedQuiz.title) {
          setQuizGenerated(true)
          setQuizTitle(parsedQuiz.title || "Generated Quiz")
        }
      }
    } catch (error) {
      console.error("Failed to parse quiz data:", error)
      // Clear invalid data
      sessionStorage.removeItem("generatedQuiz")
    }
  }, [])
  
  const handleStartQuiz = () => {
    // Get quiz from session storage
    try {
      const storedQuiz = sessionStorage.getItem("generatedQuiz")
      
      if (storedQuiz && storedQuiz !== "undefined" && storedQuiz !== "null") {
        // Save as active quiz with start time
        const parsedQuiz = JSON.parse(storedQuiz)
        sessionStorage.setItem("activeQuiz", JSON.stringify({
          ...parsedQuiz,
          startTime: new Date().toISOString()
        }))
        
        // Redirect directly to quiz
        router.push("/quiz")
      } else {
        console.error("No valid quiz data found in session storage")
      }
    } catch (error) {
      console.error("Error starting quiz:", error)
    }
  }
  
  const handleUploadSuccess = (title: string) => {
    setQuizGenerated(true)
    setQuizTitle(title)
  }

  // Add this function to clear any existing quiz data before generating a new quiz
  const clearExistingQuizData = () => {
    // Clear existing quiz results and active quiz
    clearQuizData();
    clearYouTubeData();
    console.log("Cleared existing quiz data");
  }

  // Function to handle any unexpected errors
  const handleError = (error: Error) => {
    console.error("Upload section error:", error);
    // You could log this to a service or perform additional actions
  }

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Generate Quiz Material</h1>
        
        {quizGenerated ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quiz Generated Successfully!</CardTitle>
              <CardDescription>Your quiz is ready to take based on the uploaded content.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                <strong>Quiz Title:</strong> {quizTitle}
              </p>
              <p>You can start the quiz now or upload a different document/video to generate a new quiz.</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  clearExistingQuizData();
                  setQuizGenerated(false);
                }}
              >
                Create New Quiz
              </Button>
              <Button onClick={handleStartQuiz}>
                Start Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <ErrorBoundary 
            fallback={<ErrorFallback />}
            onError={handleError}
          >
            <UploadSection onSuccess={handleUploadSuccess} defaultTab="pdf" />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
