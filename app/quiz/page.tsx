"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Clock, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Quiz interface
interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  startTime?: string;
}

export default function QuizPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(1200) // 20 minutes in seconds
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  
  const router = useRouter()
  const { toast } = useToast()

  // Load quiz on mount
  useEffect(() => {
    const storedQuiz = sessionStorage.getItem("activeQuiz")
    
    if (storedQuiz) {
      try {
        const parsedQuiz = JSON.parse(storedQuiz)
        
        // Add startTime if not already present
        if (!parsedQuiz.startTime) {
          parsedQuiz.startTime = new Date().toISOString();
          // Update session storage with start time
          sessionStorage.setItem("activeQuiz", JSON.stringify(parsedQuiz));
          console.log("Quiz start time initialized:", parsedQuiz.startTime);
        } else {
          console.log("Quiz already has start time:", parsedQuiz.startTime);
        }
        
        setQuiz(parsedQuiz)
        
        // Initialize empty answers for all questions
        const initialAnswers: Record<number, number> = {}
        parsedQuiz.questions.forEach((_: any, index: number) => {
          initialAnswers[index] = -1 // -1 means unanswered
        })
        setUserAnswers(initialAnswers)
      } catch (error) {
        console.error("Failed to parse quiz data:", error)
        toast({
          title: "Error loading quiz",
          description: "Quiz data is corrupted. Please try again.",
          variant: "destructive"
        })
        router.push("/upload")
      }
    } else {
      toast({
        title: "No active quiz",
        description: "Please generate a quiz first",
        variant: "destructive"
      })
      router.push("/upload")
    }
    
    setLoading(false)
  }, [router, toast])

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !quizSubmitted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !quizSubmitted) {
      handleSubmitQuiz()
    }
  }, [timeLeft, quizSubmitted])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  const handleNextQuestion = () => {
    if (quiz && currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleAnswerChange = (questionIndex: number, selectedOption: number) => {
    setUserAnswers({
      ...userAnswers,
      [questionIndex]: selectedOption
    })
  }

  const handleSubmitQuiz = () => {
    if (!quiz) return
    
    setQuizSubmitted(true)
    
    // Calculate score
    let correctAnswers = 0
    quiz.questions.forEach((question, index) => {
      if (userAnswers[index] === question.answer) {
        correctAnswers++
      }
    })
    
    const finalScore = Math.round((correctAnswers / quiz.questions.length) * 100)
    setScore(finalScore)
    
    // Calculate time taken (in seconds)
    const timeTaken = quiz.startTime 
      ? Math.floor((new Date().getTime() - new Date(quiz.startTime).getTime()) / 1000)
      : 0
    
    console.log("Quiz submission:", {
      startTime: quiz.startTime,
      endTime: new Date().toISOString(),
      timeTaken: timeTaken
    });
    
    // Store results in session storage
    const results = {
      quizId: quiz.id,
      title: quiz.title,
      score: finalScore,
      totalQuestions: quiz.questions.length,
      correctAnswers,
      userAnswers,
      completedAt: new Date().toISOString(),
      timeTaken: timeTaken,
      timeAllotted: 1200, // 20 minutes in seconds
    }
    
    sessionStorage.setItem("quizResults", JSON.stringify(results))
    
    // Navigate to results page instead of showing results in this component
    router.push('/quiz-results')
  }

  const isQuestionAnswered = (questionIndex: number) => {
    return userAnswers[questionIndex] !== undefined && userAnswers[questionIndex] !== -1
  }

  const allQuestionsAnswered = () => {
    if (!quiz) return false
    return quiz.questions.every((_, index) => isQuestionAnswered(index))
  }

  if (loading || !quiz) {
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

  // If quiz is submitted and showing results
  if (quizSubmitted && showResults) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col items-center mb-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Quiz Results</h1>
            <div className="text-6xl font-bold mb-4">{score}%</div>
            <p className="text-lg mb-4">
              You got {quiz.questions.filter((q, i) => userAnswers[i] === q.answer).length} out of {quiz.questions.length} questions correct
            </p>
            
            <div className="flex gap-4 mt-4">
              <Button variant="outline" onClick={() => router.push('/upload')}>
                New Quiz
              </Button>
              <Button onClick={() => setShowResults(false)}>
                Review Answers
              </Button>
            </div>
          </div>
          
          {!showResults && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mt-8">Question Review</h2>
              {quiz.questions.map((question, index) => (
                <Card key={index} className={`mb-4 border-2 ${userAnswers[index] === question.answer ? "border-green-200" : "border-red-200"}`}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                    {userAnswers[index] === question.answer ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium mb-4">{question.question}</p>
                    <div className="space-y-3">
                      {question.options.map((option, optionIndex) => (
                        <div 
                          key={optionIndex} 
                          className={`flex items-center space-x-2 p-2 rounded ${
                            optionIndex === question.answer ? "bg-green-100" : 
                            (optionIndex === userAnswers[index] && optionIndex !== question.answer) ? "bg-red-100" : ""
                          }`}
                        >
                          <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${
                            optionIndex === userAnswers[index] ? "bg-primary border-primary" : "border-gray-300"
                          }`}>
                            {optionIndex === userAnswers[index] && (
                              <div className="h-2 w-2 rounded-full bg-white"></div>
                            )}
                          </div>
                          <p>{option}</p>
                          {optionIndex === question.answer && (
                            <span className="text-green-600 ml-auto text-sm">(Correct answer)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Active quiz view
  const question = quiz.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-3xl font-bold">{quiz.title}</h1>
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push("/quiz-preview")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Exit Quiz
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{question.question}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={userAnswers[currentQuestion]?.toString() || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion, Number(value))}
            >
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePrevQuestion} disabled={currentQuestion === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              {currentQuestion === quiz.questions.length - 1 ? (
                <Button 
                  onClick={handleSubmitQuiz} 
                  disabled={!allQuestionsAnswered()}
                  variant={allQuestionsAnswered() ? "default" : "outline"}
                >
                  Submit Quiz
                </Button>
              ) : (
                <Button onClick={handleNextQuestion}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {quiz.questions.map((_, index) => (
            <Button
              key={index}
              variant={
                index === currentQuestion
                  ? "default"
                  : isQuestionAnswered(index)
                    ? "outline"
                    : "ghost"
              }
              size="icon"
              className="h-10 w-10"
              onClick={() => setCurrentQuestion(index)}
            >
              {index + 1}
            </Button>
          ))}
        </div>
        
        <div className="mt-8 flex justify-center">
          <Button 
            onClick={handleSubmitQuiz} 
            disabled={!allQuestionsAnswered()}
            variant={allQuestionsAnswered() ? "default" : "outline"}
            size="lg"
          >
            Submit Quiz
          </Button>
        </div>
      </div>
    </div>
  )
}
