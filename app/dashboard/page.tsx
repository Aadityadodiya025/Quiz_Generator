"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"
import { ArrowUpRight, Award, BarChart3, BookOpen, Clock, Download, FileText, PieChartIcon, Share2, Youtube, FileTextIcon, FileIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Types for user quiz data
interface QuizResult {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number; 
  date: string;
  timeTaken: number;
  difficulty: string;
  topic?: string;
}

// Types for user summary data
interface TextSummary {
  _id?: string;
  title: string;
  originalText: string;
  summary: string;
  wordCount: number;
  date: string;
}

interface VideoSummary {
  _id?: string;
  videoId: string;
  title: string;
  url: string;
  summary: string;
  duration: number;
  date: string;
}

interface TopicPerformance {
  name: string;
  score: number;
  quizCount: number;
}

interface DifficultyDistribution {
  name: string;
  value: number;
}

interface TimeData {
  name: string;
  minutes: number;
}

const COLORS = ["#3b82f6", "#14b8a6", "#6366f1", "#8b5cf6"]

export default function DashboardPage() {
  const { data: session, status } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  
  // State for user quiz data
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([])
  const [difficultyData, setDifficultyData] = useState<DifficultyDistribution[]>([])
  const [timeSpentData, setTimeSpentData] = useState<TimeData[]>([])
  const [totalStudyTime, setTotalStudyTime] = useState(0)
  
  // State for summary data
  const [textSummaries, setTextSummaries] = useState<TextSummary[]>([]);
  const [videoSummaries, setVideoSummaries] = useState<VideoSummary[]>([]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      toast({
        title: "Authentication Required",
        description: "Please log in to view your dashboard.",
        variant: "destructive"
      })
    }
  }, [status, router, toast])
  
  // Fetch user quiz data when authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetchUserQuizData()
      fetchUserSummaryData()
    }
  }, [status, session])
  
  // Function to fetch user quiz data
  const fetchUserQuizData = async () => {
    setLoading(true)
    try {
      // First try API endpoint
      const response = await fetch("/api/user-quizzes")
      
      if (response.ok) {
        const data = await response.json()
        if (data.quizzes && data.quizzes.length > 0) {
          processQuizData(data.quizzes)
        } else {
          // If no data from API, try local storage as fallback
          loadLocalQuizData()
        }
      } else {
        // If API fails, try local storage
        loadLocalQuizData()
      }
    } catch (error) {
      console.error("Error fetching quiz data:", error)
      loadLocalQuizData()
    } finally {
      setLoading(false)
    }
  }
  
  // Load quiz data from localStorage as fallback
  const loadLocalQuizData = () => {
    if (typeof window !== 'undefined') {
      try {
        // Try to load from local storage
        const storedHistory = localStorage.getItem("quizHistory")
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory)
          processQuizData(parsedHistory)
        } else {
          // If no data found, use empty data
          setQuizResults([])
          setTopicPerformance([])
          setDifficultyData([
            { name: "Easy", value: 0 },
            { name: "Medium", value: 0 },
            { name: "Hard", value: 0 }
          ])
          setTimeSpentData([])
          setTotalStudyTime(0)
        }
      } catch (error) {
        console.error("Error loading local quiz data:", error)
        // Initialize with empty data
        setQuizResults([])
      }
    }
  }
  
  // Process quiz data to generate stats
  const processQuizData = (quizzes: QuizResult[]) => {
    // First, deduplicate quizzes to prevent double-counting
    const uniqueMap = new Map<string, QuizResult>();
    
    // Use a composite key to detect duplicates (combine id or title+date+score)
    quizzes.forEach(quiz => {
      const key = quiz.id || `${quiz.title}_${quiz.date}_${quiz.score}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, quiz);
      }
    });
    
    // Get the deduplicated array
    const deduplicatedQuizzes = Array.from(uniqueMap.values());
    console.log(`Deduplicated ${quizzes.length} quizzes to ${deduplicatedQuizzes.length} unique quizzes`);
    
    // Sort quizzes by date (newest first)
    const sortedQuizzes = [...deduplicatedQuizzes].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    setQuizResults(sortedQuizzes);
    
    // Generate topic performance data
    const topicMap = new Map<string, { totalScore: number, count: number }>();
    
    deduplicatedQuizzes.forEach(quiz => {
      const topic = quiz.topic || getTopic(quiz.title)
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { totalScore: 0, count: 0 })
      }
      
      const topicData = topicMap.get(topic)!
      topicData.totalScore += quiz.score
      topicData.count += 1
    })
    
    const topicData: TopicPerformance[] = Array.from(topicMap.entries()).map(([name, data]) => ({
      name,
      score: Math.round(data.totalScore / data.count),
      quizCount: data.count
    }))
    
    setTopicPerformance(topicData)
    
    // Generate difficulty distribution
    const difficultyMap = new Map<string, number>()
    difficultyMap.set("Easy", 0)
    difficultyMap.set("Medium", 0)
    difficultyMap.set("Hard", 0)
    
    deduplicatedQuizzes.forEach(quiz => {
      const difficulty = quiz.difficulty || "Medium"
      difficultyMap.set(difficulty, (difficultyMap.get(difficulty) || 0) + 1)
    })
    
    const difficultyDist: DifficultyDistribution[] = Array.from(difficultyMap.entries()).map(([name, value]) => ({
      name,
      value
    }))
    
    setDifficultyData(difficultyDist)
    
    // Generate time spent data
    const timeMap = new Map<string, number>()
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    
    // Initialize all days to 0
    days.forEach(day => timeMap.set(day, 0))
    
    // Calculate total study time and per-day breakdown
    let totalTime = 0
    
    deduplicatedQuizzes.forEach(quiz => {
      // Add to total time
      const timeInMinutes = quiz.timeTaken ? Math.round(quiz.timeTaken / 60) : 0
      totalTime += timeInMinutes
      
      // Add to day of week
      if (quiz.date) {
        const date = new Date(quiz.date)
        const day = days[date.getDay()]
        timeMap.set(day, (timeMap.get(day) || 0) + timeInMinutes)
      }
    })
    
    const timeData: TimeData[] = days.map(day => ({
      name: day,
      minutes: timeMap.get(day) || 0
    }))
    
    setTimeSpentData(timeData)
    setTotalStudyTime(totalTime)
  }
  
  // Helper to extract topic from quiz title if not provided
  const getTopic = (title: string): string => {
    // Extract topic from title or return "General"
    if (!title) return "General"
    
    const commonTopics = ["Mathematics", "Science", "History", "English", "Computer", "Biology", "Physics"]
    for (const topic of commonTopics) {
      if (title.includes(topic)) {
        return topic
      }
    }
    
    return title.split(" ")[0] || "General"
  }
  
  // Function to fetch user summary data
  const fetchUserSummaryData = async () => {
    try {
      const response = await fetch("/api/user-summaries");
      
      if (response.ok) {
        const data = await response.json();
        if (data.summaries) {
          setTextSummaries(data.summaries);
        }
        if (data.videoSummaries) {
          setVideoSummaries(data.videoSummaries);
        }
      } else {
        // Handle errors
        console.error("Failed to fetch summary data:", response.status);
      }
    } catch (error) {
      console.error("Error fetching summary data:", error);
    }
  };
  
  // Calculate stats
  const latestQuizScore = quizResults.length > 0 ? quizResults[0].score : 0
  const averageScore = quizResults.length > 0 
    ? Math.round(quizResults.reduce((acc, curr) => acc + curr.score, 0) / quizResults.length) 
    : 0
  const totalQuizzes = quizResults.length
  const studyTimeHours = (totalStudyTime / 60).toFixed(1)
  
  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="container py-8">
        <div className="flex flex-col gap-8">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Quiz Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestQuizScore}%</div>
              <p className="text-xs text-muted-foreground">
                {latestQuizScore > averageScore ? (
                  <span className="text-green-500 flex items-center">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    {Math.round(latestQuizScore - averageScore)}% above average
                  </span>
                ) : latestQuizScore < averageScore ? (
                  <span className="text-red-500">{Math.round(averageScore - latestQuizScore)}% below average</span>
                ) : (
                  <span>Equal to your average</span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Text Summaries</CardTitle>
              <FileTextIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{textSummaries.length}</div>
              <p className="text-xs text-muted-foreground">
                {textSummaries.length > 0
                  ? `Last created on ${new Date(textSummaries[0].date).toLocaleDateString()}`
                  : 'No summaries created yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Video Summaries</CardTitle>
              <Youtube className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{videoSummaries.length}</div>
              <p className="text-xs text-muted-foreground">
                {videoSummaries.length > 0
                  ? `Last created on ${new Date(videoSummaries[0].date).toLocaleDateString()}`
                  : 'No video summaries created yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Study Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studyTimeHours} hrs</div>
              <p className="text-xs text-muted-foreground">Total study time</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="difficulty">Difficulty</TabsTrigger>
            <TabsTrigger value="time">Time Spent</TabsTrigger>
            <TabsTrigger value="textsummaries">Text Summaries</TabsTrigger>
            <TabsTrigger value="videosummaries">Video Summaries</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quiz Performance</CardTitle>
                <CardDescription>Your performance across all quizzes</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {quizResults.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quizResults.slice(-10).map(quiz => ({
                      name: quiz.title.length > 15 ? quiz.title.substring(0, 15) + '...' : quiz.title,
                      score: quiz.score
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip />
                      <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No quiz data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Quizzes</CardTitle>
                  <CardDescription>Your most recent quiz activities</CardDescription>
                </CardHeader>
                <CardContent>
                  {quizResults.length > 0 ? (
                    <div className="space-y-4">
                      {quizResults.slice(0, 3).map((quiz, index) => (
                        <div key={index} className="flex items-center">
                          <div className="mr-4 rounded-full bg-primary/10 p-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">{quiz.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Completed on {new Date(quiz.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="font-medium">{quiz.score}%</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">No quiz history available</p>
                      <Button className="mt-4" onClick={() => router.push("/upload")}>
                        Take your first quiz
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Improvement Areas</CardTitle>
                  <CardDescription>Topics that need more focus</CardDescription>
                </CardHeader>
                <CardContent>
                  {topicPerformance.length > 0 ? (
                    <div className="space-y-4">
                      {topicPerformance
                        .sort((a, b) => a.score - b.score)
                        .slice(0, 3)
                        .map((topic, index) => (
                          <div key={index} className="flex items-center">
                            <div className="mr-4 rounded-full bg-destructive/10 p-2">
                              <PieChartIcon className="h-4 w-4 text-destructive" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium leading-none">{topic.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Current score: {topic.score}% (from {topic.quizCount} quizzes)
                              </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => router.push("/upload")}>
                              Practice
                            </Button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">Complete more quizzes to identify improvement areas</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Topic Performance</CardTitle>
                <CardDescription>Your performance across different topics</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {topicPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip />
                      <Bar dataKey="score" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No topic data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="difficulty" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Difficulty Distribution</CardTitle>
                <CardDescription>Breakdown of quizzes by difficulty level</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {quizResults.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={difficultyData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {difficultyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No difficulty data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Time Spent by Day</CardTitle>
                <CardDescription>Your study time throughout the week</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {timeSpentData.some(day => day.minutes > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSpentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => [`${value} mins`, 'Time Spent']} />
                      <Line type="monotone" dataKey="minutes" stroke="#8b5cf6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No time tracking data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="textsummaries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Text Summary History</CardTitle>
                <CardDescription>Your recent document summaries</CardDescription>
              </CardHeader>
              <CardContent>
                {textSummaries.length > 0 ? (
                  <div className="space-y-4">
                    {textSummaries.map((summary, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{summary.title}</h3>
                          <Badge variant="outline">{new Date(summary.date).toLocaleDateString()}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Word count: {summary.wordCount}
                        </p>
                        <div className="text-sm border rounded-md p-3 bg-muted/30 my-2">
                          {summary.summary.length > 200
                            ? `${summary.summary.substring(0, 200)}...`
                            : summary.summary}
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="outline" 
                            size="sm"
                            onClick={() => router.push("/summary-results?id=" + summary._id)}
                          >
                            View Full Summary
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No text summary history available</p>
                    <Button className="mt-4" onClick={() => router.push("/summary")}>
                      Create your first text summary
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="videosummaries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Video Summary History</CardTitle>
                <CardDescription>Your recent video summaries</CardDescription>
              </CardHeader>
              <CardContent>
                {videoSummaries.length > 0 ? (
                  <div className="space-y-4">
                    {videoSummaries.map((summary, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{summary.title}</h3>
                          <Badge variant="outline">{new Date(summary.date).toLocaleDateString()}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Youtube className="h-3 w-3" />
                          <a 
                            href={summary.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:underline"
                          >
                            Watch video
                          </a>
                          <span className="mx-1">•</span>
                          <span>Duration: {Math.floor(summary.duration / 60)}:{(summary.duration % 60).toString().padStart(2, '0')}</span>
                        </div>
                        <div className="text-sm border rounded-md p-3 bg-muted/30 my-2">
                          {summary.summary.length > 200
                            ? `${summary.summary.substring(0, 200)}...`
                            : summary.summary}
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="outline" 
                            size="sm"
                            onClick={() => router.push("/video-summary?id=" + summary.videoId)}
                          >
                            View Full Summary
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No video summary history available</p>
                    <Button className="mt-4" onClick={() => router.push("/video-summarizer")}>
                      Create your first video summary
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quiz Generator</CardTitle>
              <CardDescription>
                Generate quiz questions from documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link href="/file-upload">
                  Upload Files
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Video Summarizer</CardTitle>
              <CardDescription>
                Generate summaries from video content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Youtube className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link href="/video-summarizer">
                  Summarize Videos
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">PDF Summarizer</CardTitle>
              <CardDescription>
                Generate summaries from PDF documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link href="/pdf-summarizer">
                  Summarize PDFs
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
