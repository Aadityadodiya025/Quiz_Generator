"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Home, FileText, Award, Clock, Timer, BarChart } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "next-auth/react"

interface QuizResults {
  quizId: string;
  title: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  userAnswers: Record<number, number | number[]>;
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
  const { data: session } = useSession()
  
  useEffect(() => {
    // Load results and quiz from session storage
    const storedResults = sessionStorage.getItem("quizResults")
    
    // Try to get quiz data from multiple possible sources
    let storedQuiz = sessionStorage.getItem("completedQuiz")
    if (!storedQuiz) {
      storedQuiz = sessionStorage.getItem("activeQuiz")
    }
    if (!storedQuiz) {
      storedQuiz = sessionStorage.getItem("generatedQuiz")
    }
    
    if (storedResults) {
      try {
        const parsedResults = JSON.parse(storedResults)
        
        // Ensure timeTaken and timeAllotted have valid values
        if (!parsedResults.timeTaken || isNaN(parsedResults.timeTaken)) {
          parsedResults.timeTaken = 0;
        }
        
        if (!parsedResults.timeAllotted || isNaN(parsedResults.timeAllotted)) {
          parsedResults.timeAllotted = 1200; // Default 20 minutes
        }
        
        setResults(parsedResults)
        
        // Try to load the quiz data
        if (storedQuiz) {
          try {
            const parsedQuiz = JSON.parse(storedQuiz)
            setQuiz(parsedQuiz)
            
            // Save quiz to history in localStorage (for profile page)
            saveQuizToHistory(parsedResults, parsedQuiz);
            
          } catch (quizError) {
            console.error("Failed to parse quiz data:", quizError)
            // Continue without quiz data - we can still show results
          }
        }
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
  
  // Function to save quiz to history in localStorage and database if authenticated
  const saveQuizToHistory = async (results: QuizResults, quizData: any) => {
    try {
      // Create a unique ID for this quiz attempt
      const quizId = `quiz_${Date.now()}`;
      
      // Create a history entry
      const historyEntry = {
        id: quizId,
        title: quizData.title || results.title || "Untitled Quiz",
        score: results.score,
        totalQuestions: results.totalQuestions,
        correctAnswers: results.correctAnswers,
        date: results.completedAt || new Date().toISOString(),
        timeTaken: results.timeTaken
      };
      
      // Save to localStorage (regardless of authentication status)
      let quizHistory = [];
      const storedHistory = localStorage.getItem("quizHistory");
      
      if (storedHistory) {
        try {
          quizHistory = JSON.parse(storedHistory);
          // Ensure it's an array
          if (!Array.isArray(quizHistory)) {
            quizHistory = [];
          }
        } catch (e) {
          console.error("Error parsing quiz history:", e);
          quizHistory = [];
        }
      }
      
      // Check if this exact quiz already exists (prevent duplicates)
      const alreadyExists = quizHistory.some(entry => 
        entry.id === quizId || 
        (entry.title === historyEntry.title && 
         entry.date === historyEntry.date && 
         entry.score === historyEntry.score)
      );
      
      if (!alreadyExists) {
        // Add new entry to the beginning of the array if it doesn't exist already
        quizHistory.unshift(historyEntry);
        
        // Limit history to last 50 quizzes
        if (quizHistory.length > 50) {
          quizHistory = quizHistory.slice(0, 50);
        }
        
        // Save back to localStorage
        localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
        
        console.log("Quiz saved to localStorage history:", historyEntry);
        
        // If user is authenticated, also save to database
        if (session?.user) {
          try {
            // First check if this quiz is already in the database
            const checkResponse = await fetch("/api/quiz-history", {
              method: "GET",
            });
            
            if (checkResponse.ok) {
              const existingData = await checkResponse.json();
              const existingEntry = existingData.history?.find((entry: any) => 
                entry.quizId === quizId || 
                (entry.title === historyEntry.title && 
                 entry.date === historyEntry.date && 
                 entry.score === historyEntry.score)
              );
              
              // Only save if not already in database
              if (!existingEntry) {
                const response = await fetch("/api/quiz-history", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    quizId: historyEntry.id,
                    title: historyEntry.title,
                    score: historyEntry.score,
                    totalQuestions: historyEntry.totalQuestions,
                    correctAnswers: historyEntry.correctAnswers,
                    date: historyEntry.date,
                    timeTaken: historyEntry.timeTaken
                  }),
                });
                
                if (!response.ok) {
                  console.error("Failed to save quiz to database:", await response.json());
                } else {
                  console.log("Quiz saved to database history");
                }
              } else {
                console.log("Quiz already exists in database, skipping save");
              }
            } else {
              console.error("Failed to check existing quiz entries:", await checkResponse.json());
            }
          } catch (dbError) {
            console.error("Error saving quiz to database:", dbError);
            // Continue even if database save fails
          }
        }
      } else {
        console.log("Quiz already exists in history, skipping duplicate save");
      }
    } catch (error) {
      console.error("Error saving quiz to history:", error);
    }
  }
  
  // Format time in minutes and seconds
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }
  
  if (loading || !results) {
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
        
        {quiz && quiz.questions && (
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
                {quiz.questions.map((q: any, index: number) => {
                  // Handle both answer formats
                  const correctAnswer = q.answer !== undefined 
                    ? q.answer 
                    : q.options?.findIndex((opt: string) => opt === q.correctAnswer) || 0;
                  
                  const isCorrect = results.userAnswers[index] === correctAnswer;
                  
                  return (
                    <div 
                      key={index}
                      className={`h-full ${isCorrect ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${100 / results.totalQuestions}%` }}
                      title={`Question ${index + 1}: ${isCorrect ? "Correct" : "Incorrect"}`}
                    ></div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="space-y-4 mb-8">
          {quiz.questions.map((question: any, index: number) => {
            // Determine if this is a multiple-choice question
            const isMultipleChoice = question.type === "multiple";
            
            // Get the correct answer(s)
            const correctAnswers = isMultipleChoice 
              ? (Array.isArray(question.answer) ? question.answer : [question.answer]) 
              : question.answer;
            
            // Get user answers
            const userSelectedAnswers = isMultipleChoice
              ? (Array.isArray(results.userAnswers[index]) ? results.userAnswers[index] : [])
              : results.userAnswers[index];
            
            // For multiple choice, check if all selections match
            const isMultipleChoiceCorrect = isMultipleChoice && 
              Array.isArray(userSelectedAnswers) && 
              Array.isArray(correctAnswers) &&
              userSelectedAnswers.length === correctAnswers.length && 
              [...userSelectedAnswers].sort().toString() === [...correctAnswers].sort().toString();
              
            // Is the answer correct overall
            const isCorrect = isMultipleChoice 
              ? isMultipleChoiceCorrect 
              : userSelectedAnswers === correctAnswers;
            
            return (
              <Card key={index} className={`
                border-l-4 
                ${isCorrect ? 
                  "border-l-green-500" : 
                  "border-l-red-500"
                }
              `}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-md">Question {index + 1}</CardTitle>
                    <CardDescription>
                      {isCorrect ? "Correct" : "Incorrect"}
                      {isMultipleChoice && " (Multiple Choice)"}
                    </CardDescription>
                  </div>
                  {isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <p className="font-medium mb-2">{question.question}</p>
                  <div className="space-y-2">
                    {question.options.map((option: string, optionIndex: number) => {
                      // For multiple choice - check if this option was selected by user
                      const wasSelected = isMultipleChoice 
                        ? Array.isArray(userSelectedAnswers) && userSelectedAnswers.includes(optionIndex)
                        : optionIndex === userSelectedAnswers;
                        
                      // For multiple choice - check if this option was correct  
                      const wasCorrect = isMultipleChoice
                        ? Array.isArray(correctAnswers) && correctAnswers.includes(optionIndex)
                        : optionIndex === correctAnswers;
                        
                      // Determine CSS class based on correctness
                      let bgColorClass = "bg-muted";
                      
                      if (wasCorrect && wasSelected) {
                        // Correct selection
                        bgColorClass = "bg-green-500/20 dark:bg-green-500/30 border border-green-500/50";
                      } else if (wasCorrect && !wasSelected) {
                        // Missed correct answer
                        bgColorClass = "bg-blue-500/20 dark:bg-blue-500/30 border border-blue-500/50";
                      } else if (!wasCorrect && wasSelected) {
                        // Incorrect selection
                        bgColorClass = "bg-red-500/20 dark:bg-red-500/30 border border-red-500/50";
                      }
                      
                      return (
                        <div 
                          key={optionIndex} 
                          className={`p-2 rounded-md flex justify-between items-center ${bgColorClass}`}
                        >
                          <div className="flex items-center gap-2">
                            {isMultipleChoice ? (
                              // Checkbox for multiple choice
                              <div className={`h-4 w-4 rounded flex-shrink-0 ${
                                wasSelected ? "bg-primary border-primary" : "border border-muted-foreground"
                              }`}>
                                {wasSelected && (
                                  <div className="h-2 w-2 rounded-sm bg-white m-auto"></div>
                                )}
                              </div>
                            ) : (
                              // Radio for single choice
                              <div className={`h-4 w-4 rounded-full flex-shrink-0 ${
                                wasSelected ? "bg-primary border-primary" : "border border-muted-foreground"
                              }`}>
                                {wasSelected && (
                                  <div className="h-2 w-2 rounded-full bg-white m-auto"></div>
                                )}
                              </div>
                            )}
                            <span>{option}</span>
                          </div>
                          <div>
                            {wasCorrect && (
                              <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Correct Answer
                              </span>
                            )}
                            {!wasCorrect && wasSelected && (
                              <span className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center">
                                <XCircle className="h-4 w-4 mr-1" />
                                Your Answer
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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