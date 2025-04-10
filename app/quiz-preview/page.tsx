"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function QuizPreviewPage() {
  const [generatedQuiz, setGeneratedQuiz] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  
  useEffect(() => {
    // Try to get the quiz data from session storage
    const storedQuiz = sessionStorage.getItem("generatedQuiz")
    
    if (storedQuiz) {
      try {
        const parsedQuiz = JSON.parse(storedQuiz)
        console.log("Retrieved quiz from session storage:", parsedQuiz)
        setGeneratedQuiz(parsedQuiz)
      } catch (error) {
        console.error("Failed to parse quiz data:", error)
        toast({
          title: "Error loading quiz",
          description: "Quiz data is corrupted",
          variant: "destructive"
        })
      }
    } else {
      console.log("No quiz data found in session storage")
      toast({
        title: "No quiz found",
        description: "Please upload a document to generate a quiz",
        variant: "destructive"
      })
      router.push("/upload")
    }
    
    setLoading(false)
  }, [router, toast])

  const handleStartQuiz = () => {
    if (generatedQuiz) {
      // Save quiz to session storage with start time
      sessionStorage.setItem("activeQuiz", JSON.stringify({
        ...generatedQuiz,
        startTime: new Date().toISOString()
      }))
      router.push("/quiz")
    }
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-8">Loading Quiz...</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-md"></div>
            <div className="h-64 bg-muted rounded-md"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!generatedQuiz) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-8">No Quiz Data</h1>
          <p className="mb-8">Unable to find quiz data. Please try uploading a document again.</p>
          <Button onClick={() => router.push('/upload')}>Go to Upload</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Quiz Preview</h1>
          <Button variant="outline" onClick={() => router.push("/upload")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Upload
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
            <CardDescription>Review your generated quiz before starting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <p className="font-medium">Source Document:</p>
                <p className="text-muted-foreground">{generatedQuiz.title || "Uploaded document"}</p>
              </div>
              <div>
                <p className="font-medium">Number of Questions:</p>
                <p className="text-muted-foreground">{generatedQuiz.questions?.length || 0}</p>
              </div>
              <div>
                <p className="font-medium">Estimated Time:</p>
                <p className="text-muted-foreground">{(generatedQuiz.questions?.length || 0) * 2} minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Questions</h2>
          {generatedQuiz.questions?.map((question: any, index: number) => (
            <Card key={index} className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Question {index + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-4">{question.question}</p>
                <div className="space-y-3">
                  {question.options?.map((option: string, optionIndex: number) => (
                    <div key={optionIndex} className="flex items-start space-x-2">
                      <div className="w-4 h-4 mt-1 rounded-full border border-primary"></div>
                      <p>{option}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end mt-8">
          <Button size="lg" onClick={handleStartQuiz}>
            Start Quiz
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}