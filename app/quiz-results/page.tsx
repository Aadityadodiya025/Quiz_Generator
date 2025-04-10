"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Home, FileText, Award, Clock, Timer, BarChart } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface QuizResults {
  quizId: string;
  title: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  userAnswers: Record<number, number>;
  completedAt: string;
  timeTaken: number;
  timeAllotted: number;
}

export default function QuizResultsPage() {
  const [results, setResults] = useState<QuizResults | null>(null)
  const [quiz, setQuiz] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  
  useEffect(() => {
    // Load results and quiz from session storage
    const storedResults = sessionStorage.getItem("quizResults")
    const storedQuiz = sessionStorage.getItem("activeQuiz")
    
    if (storedResults && storedQuiz) {
      try {
        const parsedResults = JSON.parse(storedResults)
        const parsedQuiz = JSON.parse(storedQuiz)
        
        // Ensure timeTaken and timeAllotted have valid values
        if (!parsedResults.timeTaken || isNaN(parsedResults.timeTaken)) {
          parsedResults.timeTaken = 0;
        }
        
        if (!parsedResults.timeAllotted || isNaN(parsedResults.timeAllotted)) {
          parsedResults.timeAllotted = 1200; // Default 20 minutes
        }
        
        setResults(parsedResults)
        setQuiz(parsedQuiz)
      } catch (error) {
        console.error("Failed to parse quiz results:", error)
        toast({
          title: "Error loading results",
          description: "Could not load your quiz results",
          variant: "destructive"
        })
        router.push("/upload")
      }
    } else {
      toast({
        title: "No results available",
        description: "Please complete a quiz first",
        variant: "destructive"
      })
      router.push("/upload")
    }
    
    setLoading(false)
  }, [router, toast])
  
  // Format time in minutes and seconds
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }
  
  if (loading || !results || !quiz) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-8">Loading Results...</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-md"></div>
            <div className="h-64 bg-muted rounded-md"></div>
          </div>
        </div>
      </div>
    )
  }
  
  // Calculate time efficiency percentage (lower is better)
  const timeEfficiency = Math.min(100, Math.round((results.timeTaken / results.timeAllotted) * 100))
  
  // Calculate average time per question
  const avgTimePerQuestion = Math.round(results.timeTaken / results.totalQuestions)
  
  // Debug logs for performance data
  console.log("Results data:", {
    score: results.score,
    correctAnswers: results.correctAnswers,
    totalQuestions: results.totalQuestions,
    timeTaken: results.timeTaken,
    timeAllotted: results.timeAllotted,
    timeEfficiency: timeEfficiency,
    avgTimePerQuestion: avgTimePerQuestion
  });
  
  // Ensure correct values for score visualization
  const correctPercent = results.totalQuestions > 0 
    ? Math.round((results.correctAnswers / results.totalQuestions) * 100) 
    : 0;
    
  const incorrectPercent = results.totalQuestions > 0 
    ? Math.round(((results.totalQuestions - results.correctAnswers) / results.totalQuestions) * 100)
    : 0;
    
  // Ensure time efficiency is never 0 for visualization purposes
  const safeTimeEfficiency = timeEfficiency > 0 ? timeEfficiency : 5;
  
  console.log("Performance chart values:", { correctPercent, incorrectPercent, safeTimeEfficiency });
  
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center mb-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Quiz Results</h1>
          
          <div className="w-40 h-40 relative mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-4xl font-bold">{results.score}%</div>
            </div>
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle 
                className="stroke-muted fill-none" 
                cx="50" cy="50" r="40" 
                strokeWidth="8"
              />
              <circle 
                className={`
                  ${results.score >= 70 ? 'stroke-green-500' : results.score >= 40 ? 'stroke-amber-500' : 'stroke-red-500'} 
                  fill-none
                `}
                cx="50" cy="50" r="40" 
                strokeWidth="8"
                strokeDasharray={`${results.score * 2.51} 251`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
            </svg>
          </div>
          
          <p className="text-lg mb-4">
            You got {results.correctAnswers} out of {results.totalQuestions} questions correct
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button variant="outline" onClick={() => router.push('/upload')}>
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={() => router.push('/quiz')}>
              <FileText className="mr-2 h-4 w-4" />
              Review Answers
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Score Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <Award className="mr-2 h-5 w-5 text-primary" />
                Score Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium mb-1">Overall Score</p>
                <div className="flex items-center justify-between mb-1">
                  <span>{results.score}%</span>
                  <span>
                    {results.score >= 70 ? "Excellent!" : 
                     results.score >= 40 ? "Good effort!" : 
                     "Needs improvement"}
                  </span>
                </div>
                <Progress
                  value={results.score} 
                  className={`h-2 ${
                    results.score >= 70 ? "bg-green-500" : 
                    results.score >= 40 ? "bg-amber-500" : 
                    "bg-red-500"
                  }`}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Questions</p>
                  <p className="text-2xl font-bold">{results.totalQuestions}</p>
                </div>
                
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Correct answers</p>
                  <p className="text-2xl font-bold">{results.correctAnswers}</p>
                </div>
              </div>
              
              {/* Score distribution graph */}
              <div className="pt-4">
                <p className="font-medium mb-2">Performance</p>
                <div className="flex items-end h-24 space-x-2">
                  <div className="flex flex-col items-center flex-1">
                    <div 
                      className="w-full bg-green-500 rounded-t-sm" 
                      style={{ height: `${correctPercent}%`, minHeight: '4px' }}
                    ></div>
                    <p className="text-xs mt-1">Correct ({results.correctAnswers})</p>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <div 
                      className="w-full bg-red-500 rounded-t-sm" 
                      style={{ height: `${incorrectPercent}%`, minHeight: '4px' }}
                    ></div>
                    <p className="text-xs mt-1">Incorrect ({results.totalQuestions - results.correctAnswers})</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Time Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5 text-primary" />
                Time Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Time taken</p>
                  <p className="text-2xl font-bold">{formatTime(results.timeTaken)}</p>
                </div>
                
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Time per question</p>
                  <p className="text-2xl font-bold">{formatTime(avgTimePerQuestion)}</p>
                </div>
              </div>
              
              <div>
                <p className="font-medium mb-1">Time efficiency</p>
                <div className="flex items-center justify-between mb-1">
                  <span>{formatTime(results.timeTaken)}</span>
                  <span>
                    {safeTimeEfficiency <= 30 ? "Very fast!" : 
                     safeTimeEfficiency <= 60 ? "Good pace" : 
                     safeTimeEfficiency <= 90 ? "Steady pace" : 
                     "Used most of the time"}
                  </span>
                </div>
                <Progress
                  value={safeTimeEfficiency} 
                  className={`h-2 ${
                    safeTimeEfficiency <= 30 ? "bg-green-500" : 
                    safeTimeEfficiency <= 60 ? "bg-blue-500" : 
                    safeTimeEfficiency <= 90 ? "bg-amber-500" : 
                    "bg-orange-500"
                  }`}
                />
              </div>
              
              {/* Time usage visualization */}
              <div className="pt-4">
                <p className="font-medium mb-2">Time usage</p>
                <div className="relative h-10 bg-muted rounded-md overflow-hidden">
                  <div 
                    className={`absolute top-0 left-0 h-full ${
                      safeTimeEfficiency <= 50 ? "bg-green-500" : 
                      safeTimeEfficiency <= 75 ? "bg-amber-500" : 
                      "bg-orange-500"
                    }`} 
                    style={{ width: `${safeTimeEfficiency}%`, minWidth: '10px' }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center text-sm">
                    {formatTime(results.timeTaken)} / {formatTime(results.timeAllotted)}
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground pt-2">
                <p>Quiz completed on: {new Date(results.completedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">Question Summary</h2>
        
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Performance at a glance</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm">Correct ({results.correctAnswers})</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-sm">Incorrect ({results.totalQuestions - results.correctAnswers})</span>
                </div>
              </div>
            </div>
            
            {/* Questions summary visualization */}
            <div className="flex h-8 mb-6 rounded-md overflow-hidden">
              {quiz.questions.map((_: any, index: number) => (
                <div 
                  key={index}
                  className={`h-full ${
                    results.userAnswers[index] === quiz.questions[index].answer ? 
                      "bg-green-500" : "bg-red-500"
                  }`}
                  style={{ width: `${100 / results.totalQuestions}%` }}
                  title={`Question ${index + 1}: ${
                    results.userAnswers[index] === quiz.questions[index].answer ? 
                      "Correct" : "Incorrect"
                  }`}
                ></div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-4 mb-8">
          {quiz.questions.map((question: any, index: number) => (
            <Card key={index} className={`
              border-l-4 
              ${results.userAnswers[index] === question.answer ? 
                "border-l-green-500" : 
                "border-l-red-500"
              }
            `}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-md">Question {index + 1}</CardTitle>
                  <CardDescription>
                    {results.userAnswers[index] === question.answer ? 
                      "Correct" : 
                      "Incorrect"
                    }
                  </CardDescription>
                </div>
                {results.userAnswers[index] === question.answer ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-2">{question.question}</p>
                <div className="space-y-2">
                  {question.options.map((option: string, optionIndex: number) => (
                    <div 
                      key={optionIndex} 
                      className={`p-2 rounded-md ${
                        optionIndex === question.answer ? 
                          "bg-green-100" : 
                        optionIndex === results.userAnswers[index] && 
                        optionIndex !== question.answer ? 
                          "bg-red-100" : 
                          "bg-gray-50"
                      }`}
                    >
                      {option}
                      {optionIndex === question.answer && (
                        <span className="ml-2 text-sm text-green-600">(Correct)</span>
                      )}
                      {optionIndex === results.userAnswers[index] && 
                       optionIndex !== question.answer && (
                        <span className="ml-2 text-sm text-red-600">(Your answer)</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-center">
          <Button onClick={() => router.push('/upload')}>
            Generate New Quiz
          </Button>
        </div>
      </div>
    </div>
  )
} 