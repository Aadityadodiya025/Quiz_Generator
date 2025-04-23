"use client"

import { useState, useEffect, FormEvent } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { User, Mail, Key, History, FileText } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Label } from "@/components/ui/label"

export default function ProfilePage() {
  const { data: session, status, update } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [quizHistory, setQuizHistory] = useState([])
  
  // User profile information states
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  
  useEffect(() => {
    // Redirect if not authenticated
    if (status === "unauthenticated") {
      router.push("/login")
    }
    
    // Load user data when session is available
    if (session?.user) {
      setName(session.user.name || "")
      setEmail(session.user.email || "")
      
      // Load quiz history from API if authenticated
      const loadQuizHistory = async () => {
        try {
          const response = await fetch("/api/quiz-history")
          const data = await response.json()
          
          if (response.ok && data.history) {
            // Format the database history to match the expected format
            const formattedHistory = data.history.map((item: any) => ({
              id: item.quizId,
              title: item.title,
              score: item.score,
              totalQuestions: item.totalQuestions || 0,
              correctAnswers: item.correctAnswers || 0,
              date: item.date,
              timeTaken: item.timeTaken || 0
            }))
            
            setQuizHistory(formattedHistory)
          } else {
            // Fall back to localStorage
            loadLocalQuizHistory()
          }
        } catch (error) {
          console.error("Error loading quiz history from API:", error)
          // Fall back to localStorage
          loadLocalQuizHistory()
        }
      }
      
      loadQuizHistory()
    } else {
      // If not authenticated, use localStorage
      loadLocalQuizHistory()
    }
  }, [session, status, router])
  
  // Function to load quiz history from localStorage
  const loadLocalQuizHistory = () => {
    if (typeof window !== "undefined") {
      const storedHistory = localStorage.getItem("quizHistory")
      if (storedHistory) {
        try {
          const parsedHistory = JSON.parse(storedHistory)
          setQuizHistory(parsedHistory)
        } catch (error) {
          console.error("Error parsing quiz history:", error)
          setQuizHistory([])
        }
      }
    }
  }
  
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile")
      }

      // Update the session data
      await update({
        ...session,
        user: {
          ...session?.user,
          name,
          email,
        },
      })

      setSuccess("Profile updated successfully")
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setIsPasswordLoading(true)
    setPasswordError("")
    setPasswordSuccess("")

    // Validate password inputs
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      setIsPasswordLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long")
      setIsPasswordLoading(false)
      return
    }

    try {
      const response = await fetch("/api/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to update password")
      }

      setPasswordSuccess("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPasswordError(err.message || "Something went wrong")
    } finally {
      setIsPasswordLoading(false)
    }
  }
  
  // Format date string nicely
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return "Unknown date"
    }
  }
  
  // Format time duration nicely
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "N/A"
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes === 0) {
      return `${remainingSeconds}s`
    }
    
    return `${minutes}m ${remainingSeconds}s`
  }
  
  if (status === "loading") {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">Loading profile...</div>
      </div>
    )
  }
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="history">Quiz History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details here.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="text-destructive text-sm">{error}</div>
                )}
                {success && (
                  <div className="text-green-600 text-sm">{success}</div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  type="submit" 
                  disabled={isLoading}
                  onClick={handleSubmit}
                >
                  {isLoading ? "Updating..." : "Update Profile"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordChange}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {passwordError && (
                  <div className="text-destructive text-sm">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="text-green-600 text-sm">{passwordSuccess}</div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  type="submit" 
                  disabled={isPasswordLoading}
                  onClick={handlePasswordChange}
                >
                  {isPasswordLoading ? "Updating..." : "Update Password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Quiz History</CardTitle>
              <CardDescription>View your past quiz attempts and results.</CardDescription>
            </CardHeader>
            <CardContent>
              {quizHistory && quizHistory.length > 0 ? (
                <div className="space-y-4">
                  {quizHistory.map((quiz: any, index) => (
                    <div key={index} className="flex items-center p-4 border rounded-lg gap-4 hover:bg-muted/30 transition-colors">
                      <div className={`p-2 rounded-full ${
                        quiz.score >= 70 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : 
                        quiz.score >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : 
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-medium">{quiz.title || "Untitled Quiz"}</h3>
                        <div className="flex flex-col sm:flex-row sm:gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className={`
                              ${quiz.score >= 70 ? "text-green-600 dark:text-green-400" : 
                                quiz.score >= 40 ? "text-amber-600 dark:text-amber-400" : 
                                "text-red-600 dark:text-red-400"}
                            `}>
                              Score: {quiz.score}%
                            </span>
                            ({quiz.correctAnswers}/{quiz.totalQuestions})
                          </span>
                          <span>Time: {formatTime(quiz.timeTaken)}</span>
                          <span>Date: {formatDate(quiz.date)}</span>
                        </div>
                      </div>
                      {quiz.id && (
                        <Button variant="outline" size="sm" onClick={() => router.push(`/quiz-results?id=${quiz.id}`)}>
                          View
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No quiz history yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    When you take quizzes, they'll appear here.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => router.push("/upload")}>
                    Take a Quiz
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 