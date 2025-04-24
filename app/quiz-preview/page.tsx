"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAppSelector } from "@/store/hooks"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Define the quiz data structure we expect
interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer?: string;
  answer?: number;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

export default function QuizPreviewPage() {
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  
  // Get quiz data from Redux store using typed hook
  const reduxQuizData = useAppSelector((state) => state.quiz?.data)
  
  useEffect(() => {
    // Function to normalize quiz data structure
    const normalizeQuizData = (data: any): QuizData | null => {
      // First check if data exists
      if (!data) {
        console.log("No quiz data provided");
        return null;
      }
      
      // Check if the data is an empty object
      if (typeof data === 'object' && Object.keys(data).length === 0) {
        console.log("Empty quiz data object, skipping");
        return null;
      }
      
      // Check if we have the minimal required structure
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        console.error("Invalid quiz data structure:", data);
        return null;
      }
      
      // Normalize the structure
      return {
        title: data.title || "Generated Quiz",
        questions: data.questions.map((q: any) => ({
          question: q.question || "Question not available",
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          answer: q.answer
        }))
      };
    };
    
    const loadQuizData = async () => {
      let quizData = null;
      
      // First try to get from Redux store
      if (reduxQuizData) {
        console.log("Attempting to use quiz data from Redux store");
        quizData = normalizeQuizData(reduxQuizData);
        if (quizData) {
          console.log("Successfully loaded quiz data from Redux store");
          setGeneratedQuiz(quizData);
          setLoading(false);
          return;
        } else {
          console.warn("Redux store contains invalid quiz data:", reduxQuizData);
        }
      }
      
      // If not in Redux, try session storage
      try {
        console.log("Attempting to load quiz data from session storage");
        
        // Try "generatedQuiz" key first (from upload-section)
        let storedQuiz = sessionStorage.getItem("generatedQuiz");
        let sourceKey = "generatedQuiz";
        
        // If not found, try "quizData" key (from quiz-section)
        if (!storedQuiz || storedQuiz === "undefined" || storedQuiz === "null") {
          storedQuiz = sessionStorage.getItem("quizData");
          sourceKey = "quizData";
        }
        
        // If not found, try "activeQuiz" key (from previous session)
        if (!storedQuiz || storedQuiz === "undefined" || storedQuiz === "null") {
          storedQuiz = sessionStorage.getItem("activeQuiz");
          sourceKey = "activeQuiz";
        }
        
        if (storedQuiz && storedQuiz !== "undefined" && storedQuiz !== "null") {
          try {
            const parsedQuiz = JSON.parse(storedQuiz);
            console.log(`Retrieved quiz from session storage (${sourceKey}):`, parsedQuiz);
            
            quizData = normalizeQuizData(parsedQuiz);
            
            if (quizData) {
              console.log("Successfully normalized quiz data from session storage");
              setGeneratedQuiz(quizData);
              setLoading(false);
              return;
            } else {
              console.error(`Invalid quiz data structure in session storage (${sourceKey}):`, parsedQuiz);
            }
          } catch (parseError) {
            console.error(`Failed to parse quiz data from session storage (${sourceKey}):`, parseError);
          }
        } else {
          console.warn("No quiz data found in session storage");
        }
      } catch (error) {
        console.error("Error accessing session storage:", error);
        // Clear invalid data
        sessionStorage.removeItem("generatedQuiz");
        sessionStorage.removeItem("quizData");
        sessionStorage.removeItem("activeQuiz");
      }
      
      // If we reach here, we couldn't load valid quiz data
      console.warn("No valid quiz data found in any storage location");
      setGeneratedQuiz(null);
      setLoading(false);
      
      toast({
        title: "No quiz found",
        description: "Please upload a document to generate a quiz",
        variant: "destructive"
      });
    };
    
    loadQuizData();
  }, [reduxQuizData, router, toast]);

  const handleStartQuiz = () => {
    if (generatedQuiz) {
      try {
        console.log("Starting quiz with data:", generatedQuiz);
        
        // Validate the quiz structure one more time
        if (!generatedQuiz.questions || generatedQuiz.questions.length === 0) {
          throw new Error("Quiz has no questions");
        }
        
        // Ensure the quiz has the correct structure with timestamp
        const formattedQuiz = {
          ...generatedQuiz,
          startTime: new Date().toISOString()
        };
        
        // Save to session storage in both locations for redundancy
        sessionStorage.setItem("activeQuiz", JSON.stringify(formattedQuiz));
        sessionStorage.setItem("generatedQuiz", JSON.stringify(generatedQuiz));
        
        console.log("Quiz data successfully saved to session storage");
        
        // Navigate to quiz page
        router.push("/quiz");
      } catch (error) {
        console.error("Error preparing quiz data:", error);
        toast({
          title: "Error",
          description: "There was a problem starting the quiz. Please try again or upload a new document.",
          variant: "destructive"
        });
      }
    } else {
      console.error("Attempted to start quiz with no data");
      toast({
        title: "No quiz available",
        description: "Please upload a document to generate a quiz first.",
        variant: "destructive"
      });
      
      // Redirect to upload page after a short delay
      setTimeout(() => {
        router.push("/upload");
      }, 1500);
    }
  };

  const handleRetryUpload = () => {
    console.log("Retrying upload, clearing existing quiz data");
    
    // Clear any existing data from all storage locations
    try {
      sessionStorage.removeItem("generatedQuiz");
      sessionStorage.removeItem("quizData");
      sessionStorage.removeItem("activeQuiz");
      console.log("Session storage cleared successfully");
      
      // Also clear from Redux (optional, handled by Redux itself on navigation)
      // But logging for clarity
      console.log("Navigating to upload page, Redux state will refresh");
      
      toast({
        title: "Starting over",
        description: "Please upload a new document to generate a quiz",
      });
      
      // Navigate to upload page
      router.push("/upload");
    } catch (error) {
      console.error("Error clearing quiz data:", error);
      
      // Force navigation even if clearing failed
      router.push("/upload");
    }
  };

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
    );
  }

  if (!generatedQuiz) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to find quiz data</AlertTitle>
            <AlertDescription>
              We couldn't locate any quiz data. This may happen if you haven't generated a quiz yet or if your session has expired.
            </AlertDescription>
          </Alert>
          
          <div className="text-center">
            <Button onClick={handleRetryUpload} size="lg">Upload a Document</Button>
          </div>
        </div>
      </div>
    );
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
          {generatedQuiz.questions?.map((question, index) => (
            <Card key={index} className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Question {index + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-4">{question.question}</p>
                <div className="space-y-3">
                  {question.options?.map((option, optionIndex) => (
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
  );
}