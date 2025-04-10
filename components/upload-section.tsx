"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface UploadSectionProps {
  onSuccess?: (quizTitle: string) => void;
}

export function UploadSection({ onSuccess }: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      validateAndSetFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (file: File) => {
    const validTypes = ["application/pdf", "text/plain"]
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or text file.",
        variant: "destructive",
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      })
      return
    }

    setFile(file)
  }

  const removeFile = () => {
    setFile(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const simulateUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      })
      return
    }
  
    // Clear any previous errors
    setErrorMessage(null)
    
    const formData = new FormData()
    formData.append("file", file)
  
    setIsUploading(true)
    setUploadProgress(10)
  
    try {
      console.log(`Uploading file: ${file.name}, type: ${file.type}, size: ${file.size}`)
      
      // Set up progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const nextProgress = prev + 5
          if (nextProgress >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return nextProgress
        })
      }, 200)
      
      // Attempt to fetch with a timeout to handle hung requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal
      })
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId)
      clearInterval(progressInterval)
      
      if (!res.ok) {
        let errorData: Record<string, any> = {}
        try {
          errorData = await res.json()
        } catch (e) {
          // If we can't parse the JSON, just use an empty object
        }
        
        console.error("Error response:", res.status, errorData)
        
        const errorMsg = 
          errorData.message || 
          errorData.error || 
          `Server error (${res.status})`
        
        setErrorMessage(errorMsg)
        
        toast({ 
          title: "Upload failed", 
          description: errorMsg,
          variant: "destructive" 
        })
        
        setIsUploading(false)
        setUploadProgress(0)
        return
      }
      
      const data = await res.json()
      console.log("Response data:", data)
      
      if (data.success && data.quiz) {
        setUploadProgress(100)
        
        // Clear any existing quiz data
        sessionStorage.removeItem("quizResults");
        sessionStorage.removeItem("activeQuiz");
        console.log("Cleared existing quiz data");
        
        // Store the generated quiz data in session storage
        sessionStorage.setItem("generatedQuiz", JSON.stringify(data.quiz))
        console.log("Stored quiz in session storage")
        
        toast({ 
          title: "Quiz generated!", 
          description: "Quiz is ready to take" 
        })
        
        // If we have an onSuccess callback, call it
        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(data.quiz.title || "Generated Quiz")
        } else {
          // Otherwise, redirect to the preview page
          setTimeout(() => router.push("/quiz-preview"), 1000)
        }
      } else {
        const errorMsg = data.error || "Failed to generate quiz"
        setErrorMessage(errorMsg)
        
        toast({ 
          title: "Error", 
          description: errorMsg,
          variant: "destructive" 
        })
        setUploadProgress(0)
      }
    } catch (err) {
      console.error("Request error:", err)
      
      const errorMsg = err instanceof Error 
        ? err.message === "The user aborted a request" 
          ? "Request timed out. Your PDF may be too large or complex."
          : err.message
        : "Could not connect to server"
      
      setErrorMessage(errorMsg)
      
      toast({ 
        title: "Network error", 
        description: errorMsg,
        variant: "destructive" 
      })
      
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Upload Your Study Material</CardTitle>
        <CardDescription>Upload a PDF or text file to generate a quiz based on its content.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          } transition-colors`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!file ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium">Drag and drop your file here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">Supports PDF and text files up to 10MB</p>
              </div>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Browse Files
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" className="hidden" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-muted p-4 rounded-md">
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[200px] sm:max-w-[300px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={removeFile} disabled={isUploading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {errorMessage && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {errorMessage}
                </div>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading and processing...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={simulateUpload} disabled={!file || isUploading}>
          {isUploading ? "Processing..." : "Generate Quiz"}
        </Button>
      </CardFooter>
    </Card>
  )
}
