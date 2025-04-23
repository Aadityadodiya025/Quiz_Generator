"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload, X, Link as LinkIcon, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppDispatch } from "@/store/hooks"
import { setQuizData } from "@/store/slices/quizSlice"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { ToastAction } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

// Define type for difficulty levels
type DifficultyLevel = "easy" | "medium" | "hard";

// Define error messages for better error handling
const errorMessages = {
  FILE_PROCESSING_ERROR: "An error occurred while processing your file. Please try again.",
  UPLOAD_TIMEOUT: "The request timed out. The file might be too large or complex.",
  INVALID_RESPONSE_FORMAT: "The server returned an invalid response format.",
  NO_TRANSCRIPT: "No transcript available for this video. Try another video with captions.",
  INVALID_URL: "The URL provided is not a valid YouTube URL.",
  PROCESSING_ERROR: "Error processing the video. Please try again later.",
  TRANSCRIPT_ERROR: "Could not retrieve a transcript for this video. Please try a different video.",
  VIDEO_UNAVAILABLE: "This video is unavailable or may be private/restricted. Try another video.",
  TIMEOUT: "Request timed out. The video might be too long or there might be network issues.",
  INVALID_FILE_TYPE: "Please upload a PDF file.",
  PDF_TOO_LARGE: "File size should not exceed 10MB.",
  PDF_EMPTY: "The PDF file is empty or contains no extractable text.",
  INSUFFICIENT_QUESTIONS: "Could not generate enough questions from this content. Please try with more detailed material."
};

// Add a utility function to validate PDF files before upload
const validatePdfFile = async (file: File): Promise<{valid: boolean, message?: string}> => {
  // Check file type
  if (file.type !== "application/pdf") {
    return { valid: false, message: "Please upload a PDF file." };
  }
  
  // Check file size
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, message: "File size should not exceed 10MB." };
  }
  
  // Check if file is not empty
  if (file.size === 0) {
    return { valid: false, message: "The PDF file is empty." };
  }
  
  // Basic header check for PDF - PDFs start with "%PDF-"
  try {
    const firstBytes = await file.slice(0, 5).arrayBuffer();
    const header = new Uint8Array(firstBytes);
    const isPdf = String.fromCharCode.apply(null, Array.from(header)) === "%PDF-";
    
    if (!isPdf) {
      return { valid: false, message: "The file does not appear to be a valid PDF. Check if it's corrupted." };
    }
  } catch (error) {
    console.error("Error checking PDF header:", error);
    // If we can't read the file, we'll still try to upload it
  }
  
  return { valid: true };
};

export function UploadSection({ 
  onSuccess, 
  defaultTab = "pdf" 
}: { 
  onSuccess?: (title: string) => void;
  defaultTab?: "pdf" | "youtube";
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [difficulty, setDifficulty] = useState<string>("medium")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [videoSummary, setVideoSummary] = useState<any>(null)
  const [summaryProcessing, setSummaryProcessing] = useState<boolean>(false)
  // Add a state to track which tab is active
  const [activeTab, setActiveTab] = useState<"pdf" | "youtube">(defaultTab as "pdf" | "youtube")
  
  const { toast } = useToast()
  const router = useRouter()
  const dispatch = useAppDispatch()

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = () => {
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    
    if (e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile)
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file",
          variant: "destructive"
        })
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const simulateUpload = async (
    file: File,
    difficulty: DifficultyLevel
  ): Promise<any> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if file is a PDF
        if (file.type !== "application/pdf") {
          toast({
            title: "Invalid File",
            description: "Please upload a PDF file.",
            variant: "destructive"
          });
          reject(new Error("INVALID_FILE_TYPE"));
          return;
        }

        // Check if file size is within limits (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: "File size should not exceed 10MB.",
            variant: "destructive"
          });
          reject(new Error("PDF_TOO_LARGE"));
          return;
        }

        setUploading(true);
        setError(null); // Clear any previous error messages

        // Create form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("difficulty", difficulty);

        // Upload timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = "An error occurred while processing your file. Please try again.";
            let errorTitle = "Error";
            
            // Check for specific error messages
            if (errorData.error === "INVALID_PDF") {
              errorMessage = "The file appears to be corrupted or is not a valid PDF.";
              errorTitle = "Invalid PDF";
            } else if (errorData.error === "PDF_EMPTY") {
              errorMessage = "The PDF file is empty or contains no extractable text.";
              errorTitle = "Empty PDF";
            } else if (errorData.error === "INSUFFICIENT_QUESTIONS") {
              errorMessage = "Could not generate enough questions from this PDF. Please upload a document with more content.";
              errorTitle = "Insufficient Content";
            } else if (errorData.error === "QUESTION_GENERATION_FAILED") {
              errorMessage = "Failed to generate questions from this PDF.";
              errorTitle = "Generation Failed";
            }
            
            toast({
              title: errorTitle,
              description: errorMessage,
              variant: "destructive"
            });
            
            setError(errorMessage);
            throw new Error(errorData.error || "FILE_PROCESSING_ERROR");
          }

          const result = await response.json();

          // Check if the response has the correct format
          if (!result || !result.data || !Array.isArray(result.data.questions) || result.data.questions.length === 0) {
            const errorMessage = "Invalid response format: missing data object or questions";
            toast({
              title: "Invalid Response",
              description: errorMessage,
              variant: "destructive"
            });
            setError(errorMessage);
            throw new Error("INVALID_RESPONSE_FORMAT");
          }

          resolve(result.data); // Return the data object that contains quizData
        } catch (error: any) {
          clearTimeout(timeoutId);
          
          if (error.name === "AbortError") {
            const errorMessage = "Request timed out. Please try again.";
            toast({
              title: "Request Timeout",
              description: errorMessage,
              variant: "destructive"
            });
            setError(errorMessage);
            throw new Error("UPLOAD_TIMEOUT");
          }
          
          // Log error details
          console.error("Error processing file:", error);
          
          // Fallback mechanism
          try {
            // Generate fallback quiz if upload fails
            const fallbackQuiz = generateEnhancedMockQuiz(file.name, difficulty);
            
            // Store fallback quiz in Redux
            dispatch(
              setQuizData({
                questions: fallbackQuiz.questions,
                sourceDocument: file.name,
                totalQuestions: fallbackQuiz.questions.length,
                estimatedTime: Math.ceil(fallbackQuiz.questions.length * 1.5),
              })
            );
            
            // Store in sessionStorage as backup
            sessionStorage.setItem(
              "quizData",
              JSON.stringify({
                questions: fallbackQuiz.questions,
                sourceDocument: file.name,
                totalQuestions: fallbackQuiz.questions.length,
                estimatedTime: Math.ceil(fallbackQuiz.questions.length * 1.5),
              })
            );
            
            // Let the user know we're using a fallback
            toast({
              title: "Using Fallback",
              description: "Couldn't process your PDF properly. Using a generated quiz instead.",
              variant: "default"
            });
            
            // Navigate to quiz preview with fallback content
            router.push("/quiz-preview");
          } catch (fallbackError) {
            console.error("Failed to create fallback quiz:", fallbackError);
            reject(error); // Propagate the original error if fallback fails
          }
          
          throw error; // Re-throw the error to be caught by the outer catch block
        }
      } catch (outerError) {
        setUploading(false); // Ensure uploading state is reset
        reject(outerError);
      } finally {
        // This will execute regardless of success or failure
        // But we only want to reset uploading if not handled by a fallback
      }
    });
  };

  const handleUploadDocument = async (selectedDifficulty: DifficultyLevel) => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file to upload.",
        variant: "destructive"
      });
      return;
    }

    // Reset error state before starting
    setError(null);
    
    try {
      // Validate file before uploading
      const validationResult = await validatePdfFile(file);
      if (!validationResult.valid) {
        toast({
          title: "Invalid File",
          description: validationResult.message || "Please upload a valid PDF file.",
          variant: "destructive"
        });
        setError(validationResult.message || "Invalid PDF file");
        return;
      }
      
      // simulateUpload already returns the quiz data from result.data
      const quizData = await simulateUpload(file, selectedDifficulty);
      
      // If we've reached here, we have successful quiz data
      toast({
        title: "Quiz Generated",
        description: `Created a ${selectedDifficulty} quiz with ${quizData.questions.length} questions.`,
        variant: "default"
      });
      
      // Store in Redux
      dispatch(
        setQuizData({
          questions: quizData.questions,
          sourceDocument: file.name,
          totalQuestions: quizData.questions.length,
          estimatedTime: Math.ceil(quizData.questions.length * 1.5), // 1.5 minutes per question
        })
      );
      
      // Store in sessionStorage as backup
      sessionStorage.setItem(
        "quizData",
        JSON.stringify({
          questions: quizData.questions,
          sourceDocument: file.name,
          totalQuestions: quizData.questions.length,
          estimatedTime: Math.ceil(quizData.questions.length * 1.5),
        })
      );
      
      // Also store as generatedQuiz for compatibility
      sessionStorage.setItem(
        "generatedQuiz",
        JSON.stringify({
          title: `Quiz on ${file.name}`,
          questions: quizData.questions,
          sourceDocument: file.name,
          totalQuestions: quizData.questions.length,
          estimatedTime: Math.ceil(quizData.questions.length * 1.5),
        })
      );
      
      // Navigate to quiz preview
      router.push("/quiz-preview");
    } catch (error: any) {
      console.error("Failed to upload document", error);
      
      // Set general error message if not already set by simulateUpload
      if (!error.message || error.message === "FILE_PROCESSING_ERROR") {
        setError("Failed to process your document. Please try again.");
      } else if (!error) {
        setError("An unexpected error occurred. Please try again.");
      }
      
      // Make sure uploading state is reset
      setUploading(false);
    }
  };

  // Enhanced fallback function to generate a more meaningful mock quiz
  const generateEnhancedMockQuiz = (fileName: string, difficulty: DifficultyLevel) => {
    try {
      // Sanitize filename by removing file extension and special characters
      const sanitizedFileName = fileName.replace(/\.\w+$/, "").replace(/[^a-zA-Z0-9\s]/g, " ").trim();
      
      // Use a default title if the filename is empty after sanitizing
      const title = sanitizedFileName || "Quiz Document";
      
      // Extract potential subject from filename to create more targeted questions
      const words = title.split(/\s+/);
      const significantWords = words.filter(word => word.length > 3);
      
      // Get the most likely subject from the filename
      const mainSubject = significantWords.length > 0 
        ? significantWords[0] 
        : (words.length > 0 ? words[0] : "the subject");
      
      // Additional related terms to make questions more varied
      const relatedTerms = [
        "concepts", "principles", "applications", "benefits", 
        "components", "history", "development", "importance", 
        "features", "characteristics"
      ];
      
      // Basic question structure that works for any topic - single-choice questions
      const singleChoiceQuestions = [
        {
          id: 1,
          question: `What is the primary purpose of ${mainSubject}?`,
          options: [
            `To provide a systematic framework for organizing information`,
            `To solve complex problems with efficient algorithms`,
            `To optimize processes and improve productivity`,
            `To enable better communication and collaboration`
          ],
          answer: 0,
          type: "single"
        },
        {
          id: 2,
          question: `Which of the following best describes ${mainSubject}?`,
          options: [
            `A methodology for analyzing and solving problems`,
            `A framework for implementing structured solutions`,
            `A system for organizing and processing information`,
            `A set of principles for optimizing performance`
          ],
          answer: 2,
          type: "single"
        },
        {
          id: 3,
          question: `What are essential components of ${mainSubject}?`,
          options: [
            `Analysis, Design, Implementation, and Testing`,
            `Planning, Organization, Direction, and Control`,
            `Input, Processing, Output, and Feedback`,
            `Concepts, Principles, Methods, and Applications`
          ],
          answer: 3,
          type: "single"
        }
      ];
      
      // Add a multiple-choice question where multiple answers are correct
      const multipleChoiceQuestions = [
        {
          id: 4,
          question: `Which of the following apply to ${mainSubject}? (Select all that apply)`,
          options: [
            `Can improve organizational efficiency`,
            `Requires specialized training to implement`,
            `Has evolved significantly over the past decade`,
            `Can be applied across different industries`
          ],
          answer: [0, 3], // Two correct answers: first and fourth options
          type: "multiple"
        },
        {
          id: 5,
          question: `What are the potential benefits of implementing ${mainSubject}? (Select all that apply)`,
          options: [
            `Improved decision-making and problem-solving abilities`,
            `Reduced need for human oversight and intervention`,
            `Enhanced efficiency and effectiveness in related tasks`,
            `Complete elimination of operational challenges`
          ],
          answer: [0, 2], // Two correct answers: first and third options
          type: "multiple"
        }
      ];
      
      // Combine single and multiple choice questions
      const questions = [...singleChoiceQuestions, ...multipleChoiceQuestions];
      
      return {
        title: `Quiz on ${title}`,
        description: `A general knowledge quiz about ${mainSubject} and related concepts.`,
        questions: questions,
        sourceDocument: fileName,
        difficulty: difficulty,
        timestamp: new Date().toISOString(),
        relatedTerms: relatedTerms,
      };
    } catch (error) {
      console.error("Error generating fallback quiz:", error);
      
      // Return a minimal valid quiz if something went wrong
      return {
        title: "General Knowledge Quiz",
        description: "A basic quiz with general knowledge questions.",
        questions: [
          {
            id: 1,
            question: "Which of these is a primary benefit of effective study techniques?",
            options: [
              "Improved retention and recall",
              "Reduced need for practice",
              "Elimination of difficult concepts",
              "Guaranteed perfect scores"
            ],
            answer: 0,
            type: "single"
          },
          {
            id: 2,
            question: "What is a key component of critical thinking?",
            options: [
              "Accepting information without questioning",
              "Analyzing and evaluating information objectively",
              "Focusing only on personal experiences",
              "Ignoring contradictory evidence"
            ],
            answer: 1,
            type: "single"
          },
          {
            id: 3,
            question: "Which of these study approaches are effective? (Select all that apply)",
            options: [
              "Active engagement and practice",
              "Studying only right before tests",
              "Regularly reviewing and applying concepts",
              "Memorizing without understanding"
            ],
            answer: [0, 2],
            type: "multiple"
          }
        ],
        sourceDocument: "Fallback Document",
        difficulty: "medium",
        timestamp: new Date().toISOString()
      };
    }
  };

  // Return the component UI
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Generate a Quiz</CardTitle>
        <CardDescription>
          Upload a PDF document to generate quiz questions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs 
          defaultValue={defaultTab} 
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "pdf" | "youtube")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="pdf">PDF Document</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pdf" className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input 
                id="file-upload"
                type="file" 
                onChange={handleInputChange} 
                accept="application/pdf" 
                className="hidden" 
              />
              {file ? (
                <>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">Drag & drop or click to upload</p>
                  <p className="text-xs text-muted-foreground">
                    PDF files only (max 10MB)
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty-pdf">Quiz Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={setDifficulty}
              >
                <SelectTrigger id="difficulty-pdf">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Easy: Basic recall questions. Medium: Standard comprehension. Hard: Advanced critical thinking.
              </p>
            </div>
            
            {error && (
              <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            
            <Button
              onClick={() => handleUploadDocument(difficulty as DifficultyLevel)}
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                "Generate Quiz from PDF"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}