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
import { UploadSection } from "@/components/upload-section"

// Quiz interface
interface QuizQuestion {
  question: string;
  options: string[];
  answer?: number | number[]; // Can be a single index or array for multiple-select
  correctAnswer?: string;
  type?: "single" | "multiple"; // Type of question: single-select or multiple-select
}

interface Quiz {
  id?: string;
  title: string;
  questions: QuizQuestion[];
  startTime?: string;
}

export default function QuizPage() {
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, number | number[]>>({})
  const [timeLeft, setTimeLeft] = useState(1200) // 20 minutes in seconds
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  
  const { toast } = useToast()

  useEffect(() => {
    // Function to normalize the quiz data structure
    const normalizeQuizData = (data: any): Quiz | null => {
      // Check if data exists
      if (!data) {
        console.log("No quiz data provided");
        return null;
      }
      
      // Check if the data is an empty object
      if (typeof data === 'object' && Object.keys(data).length === 0) {
        console.log("Empty quiz data object, skipping normalization");
        return null;
      }
      
      // Check if we have the minimal required structure
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        console.error("Invalid quiz data structure:", data);
        return null;
      }
      
      const normalizedQuestions = data.questions.map((q: any, index: number) => {
        // Handle both formats: correctAnswer (string) or answer (number)
        let answerValue = q.answer;
        
        // If answer is not provided but correctAnswer is, try to find it
        if (answerValue === undefined && q.correctAnswer) {
          // Find the index of correctAnswer in options
          const answerIndex = q.options.findIndex((option: string) => 
            option === q.correctAnswer
          );
          // If not found, default to first option
          answerValue = answerIndex === -1 ? 0 : answerIndex;
        }
        
        return {
          question: q.question || "Question not available",
          options: q.options || [],
          answer: answerValue,
          correctAnswer: q.correctAnswer,
          type: q.type || "single" // Default to single-select if not specified
        };
      });
      
      return {
        id: data.id || `quiz-${Date.now()}`,
        title: data.title || "Quiz",
        questions: normalizedQuestions,
        startTime: data.startTime
      };
    };
    
    const loadQuizData = async () => {
      // Try to get the quiz from session storage
      try {
        console.log("Attempting to load quiz data from session storage");
        
        // First try "activeQuiz"
        let storedQuiz = sessionStorage.getItem("activeQuiz");
        let sourceKey = "activeQuiz";
        
        // If not found, try "generatedQuiz"
        if (!storedQuiz || storedQuiz === "undefined" || storedQuiz === "null") {
          storedQuiz = sessionStorage.getItem("generatedQuiz");
          sourceKey = "generatedQuiz";
        }
        
        // If not found, try "quizData"
        if (!storedQuiz || storedQuiz === "undefined" || storedQuiz === "null") {
          storedQuiz = sessionStorage.getItem("quizData");
          sourceKey = "quizData";
        }
        
        if (storedQuiz && storedQuiz !== "undefined" && storedQuiz !== "null") {
          try {
            const parsedQuiz = JSON.parse(storedQuiz);
            console.log(`Retrieved quiz data from ${sourceKey}:`, parsedQuiz);
            
            const normalizedQuiz = normalizeQuizData(parsedQuiz);
            
            if (normalizedQuiz) {
              console.log("Quiz data normalized successfully");
              
              // Add startTime if not already present
              if (!normalizedQuiz.startTime) {
                normalizedQuiz.startTime = new Date().toISOString();
                console.log("Added start time to quiz data:", normalizedQuiz.startTime);
              }
              
              // Save the normalized quiz back to session storage
              sessionStorage.setItem("activeQuiz", JSON.stringify(normalizedQuiz));
              console.log("Saved normalized quiz data to activeQuiz in session storage");
              
              setQuiz(normalizedQuiz);
              
              // Initialize empty answers for all questions
              const initialAnswers: Record<number, number | number[]> = {};
              normalizedQuiz.questions.forEach((_: any, index: number) => {
                initialAnswers[index] = -1; // -1 means unanswered
              });
              setUserAnswers(initialAnswers);
              setLoading(false);
              console.log("Quiz initialized successfully with", normalizedQuiz.questions.length, "questions");
              return;
            } else {
              console.error(`Failed to normalize quiz data from ${sourceKey}:`, parsedQuiz);
              throw new Error(`Invalid quiz structure in ${sourceKey}`);
            }
          } catch (parseError) {
            console.error(`Error parsing quiz data from ${sourceKey}:`, parseError);
            throw new Error(`Failed to parse quiz data from ${sourceKey}`);
          }
        } else {
          console.warn("No valid quiz data found in session storage");
          throw new Error("No valid quiz data found");
        }
      } catch (error) {
        console.error("Failed to load quiz:", error);
        // Clean up any invalid data
        sessionStorage.removeItem("activeQuiz");
        
        // Keep other data intact in case it's valid but there's just no active quiz
        // sessionStorage.removeItem("generatedQuiz");
        // sessionStorage.removeItem("quizData");
        
        toast({
          title: "No active quiz",
          description: "Please generate a quiz first",
          variant: "default"
        });
        
        // Redirect to the upload page
        setTimeout(() => {
          router.push("/upload");
        }, 1000);
      }
      
      setLoading(false);
    };
    
    loadQuizData();
  }, [router, toast]);

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
    const currentQuestion = quiz?.questions[questionIndex];
    
    // Handle multiple-select questions differently
    if (currentQuestion?.type === "multiple") {
      // Get current selected options or initialize empty array
      const currentSelections = Array.isArray(userAnswers[questionIndex]) 
        ? [...userAnswers[questionIndex] as number[]] 
        : [];
      
      // Toggle the selection
      const selectionIndex = currentSelections.indexOf(selectedOption);
      if (selectionIndex === -1) {
        // Add the option if not already selected
        currentSelections.push(selectedOption);
      } else {
        // Remove the option if already selected
        currentSelections.splice(selectionIndex, 1);
      }
      
      // Update user answers
      setUserAnswers({
        ...userAnswers,
        [questionIndex]: currentSelections
      });
    } else {
      // Single-select questions (radio buttons)
      setUserAnswers({
        ...userAnswers,
        [questionIndex]: selectedOption
      });
    }
  }

  const handleSubmitQuiz = () => {
    if (!quiz) return
    
    try {
      setQuizSubmitted(true)
      
      // Calculate score
      let correctAnswers = 0
      quiz.questions.forEach((question, index) => {
        if (question.type === "multiple" && Array.isArray(question.answer) && Array.isArray(userAnswers[index])) {
          // For multiple-select, check if selected options match exactly
          const userSelectedOptions = userAnswers[index] as number[];
          const correctOptions = question.answer as number[];
          
          // Sort both arrays for comparison
          const sortedUser = [...userSelectedOptions].sort();
          const sortedCorrect = [...correctOptions].sort();
          
          // Check if arrays are identical
          const isCorrect = 
            sortedUser.length === sortedCorrect.length && 
            sortedUser.every((val, i) => val === sortedCorrect[i]);
          
          if (isCorrect) correctAnswers++;
        } else if (question.answer !== undefined && userAnswers[index] === question.answer) {
          // Single-select question
          correctAnswers++;
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
        quizId: quiz.id || `quiz-${Date.now()}`,
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
      
      // Also store the quiz for reference on the results page
      sessionStorage.setItem("completedQuiz", JSON.stringify(quiz))
      
      // Navigate to results page instead of showing results in this component
      router.push('/quiz-results')
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Error",
        description: "There was a problem submitting your quiz. Please try again.",
        variant: "destructive"
      });
    }
  }

  const isQuestionAnswered = (questionIndex: number) => {
    const currentQuestion = quiz?.questions[questionIndex];
    const answer = userAnswers[questionIndex];
    
    if (currentQuestion?.type === "multiple") {
      // For multiple-select, check if any option is selected
      return Array.isArray(answer) && answer.length > 0;
    }
    
    // For single-select
    return answer !== undefined && answer !== -1;
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
              You got {quiz.questions.filter((q, i) => isQuestionAnswered(i)).length} out of {quiz.questions.length} questions correct
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
                <Card key={index} className={`mb-4 border-2 ${isQuestionAnswered(index) ? "border-green-200" : "border-red-200"}`}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                    {isQuestionAnswered(index) ? (
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
            {question.type === "multiple" ? (
              // Multiple-select question with checkboxes
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-2">
                  Select all that apply
                </p>
                {question.options.map((option, index) => {
                  // Check if this option is in the user's selections
                  const isSelected = Array.isArray(userAnswers[currentQuestion]) && 
                    (userAnswers[currentQuestion] as number[]).includes(index);
                  
                  return (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`option-${index}`}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={isSelected}
                        onChange={() => handleAnswerChange(currentQuestion, index)}
                      />
                      <Label htmlFor={`option-${index}`} className="flex-1">
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single-select question with radio buttons
              <RadioGroup
                value={
                  userAnswers[currentQuestion] !== undefined 
                    ? userAnswers[currentQuestion].toString() 
                    : ""
                }
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
            )}
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
