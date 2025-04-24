"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { VideoIcon, ClipboardIcon, ArrowRightIcon, LoaderIcon, RefreshCw, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { YoutubeIcon } from "lucide-react"
import { formatDate, formatDuration, formatViewCount } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TranscriptQuality {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  confidence: number;
  issues: string[];
}

interface SummaryPoint {
  time: string;
  point: string;
}

interface VideoSummary {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
  viewCount: number;
  uploadDate: string;
  summary: string;
  hindiSummary?: string;
  gujaratiSummary?: string;
  keyPoints: SummaryPoint[];
  topics: string[];
  transcriptQuality?: TranscriptQuality;
  transcriptLength?: number;
  transcriptSource?: string;
  processedAt: string;
  detectedLanguage?: string;
}

export default function VideoSummarizerPage() {
  const [url, setUrl] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [processingStage, setProcessingStage] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number>(0)
  const [summary, setSummary] = useState<VideoSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Validate YouTube URL
  const isValidYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/
    return youtubeRegex.test(url)
  }

  // Extract Video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (isValidYouTubeUrl(text)) {
        setUrl(text)
        setError(null)
      } else {
        toast({
          title: "Invalid URL",
          description: "Please paste a valid YouTube URL",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Clipboard access denied",
        description: "Please allow clipboard access or manually enter the URL",
        variant: "destructive"
      })
    }
  }

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
      setProcessingStage("")
      setProcessingProgress(0)
      toast({
        title: "Processing cancelled",
        description: "Video summary generation was cancelled",
      })
    }
  }

  const handleSummarize = async () => {
    if (!url) {
      toast({
        title: "Missing URL",
        description: "Please enter a YouTube video URL",
        variant: "destructive"
      })
      return
    }

    if (!isValidYouTubeUrl(url)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL",
        variant: "destructive"
      })
      return
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      toast({
        title: "Invalid YouTube URL",
        description: "Could not extract video ID from the URL",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    setSummary(null)
    setError(null)
    setProcessingStage("Retrieving video details...")
    setProcessingProgress(10)

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
        
        // Update processing stage messages
        setProcessingStage(prevStage => {
          const progress = processingProgress
          if (progress < 20) return "Retrieving video details..."
          if (progress < 40) return "Getting video transcript..."
          if (progress < 60) return "Analyzing content..."
          if (progress < 80) return "Generating summary..."
          return "Finalizing results..."
        })
      }, 1000)

      const response = await fetch("/api/video-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          options: {
            includeTranscriptQuality: true,
            enhancedTimestamps: true,
            forceLiveProcessing: true
          }
        }),
        signal
      })

      clearInterval(progressInterval)
      setProcessingProgress(100)
      setProcessingStage("Processing complete!")

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to process video" }))
        const errorMessage = errorData.message || "Failed to summarize video"
        
        // Set specific error message based on error code
        if (response.status === 404) {
          setError("This video doesn't have captions or transcripts available. Please try a different video that has captions enabled.")
        } else if (response.status === 429) {
          setError("API rate limit exceeded. Please try again later.")
        } else {
          setError(errorMessage)
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        })
        
        return
      }

      const data = await response.json()
      
      // Store the summary data for other pages to use
      sessionStorage.setItem("videoSummary", JSON.stringify(data))
      sessionStorage.setItem("lastVideoUrl", url)
      
      setSummary(data)

      toast({
        title: "Summary generated",
        description: "The video has been successfully summarized",
      })
    } catch (error: any) {
      console.error("Error summarizing video:", error)
      
      // Don't show error toast if it was aborted (user cancelled)
      if (error.name === 'AbortError') {
        return
      }
      
      // Display a graceful error message
      const errorMessage = error?.message || "Failed to summarize the video. Please try again."
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      // Short delay before setting loading to false to allow the user to see the 100% progress
      setTimeout(() => {
        setLoading(false)
        abortControllerRef.current = null
      }, 500)
    }
  }

  const resetForm = () => {
    setUrl("")
    setSummary(null)
    setError(null)
  }

  const tryDemoVideo = () => {
    // Rick Astley video that will be fully processed, not using mock response
    setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    setError(null)
    toast({
      title: "Demo Video Selected",
      description: "Processing the demo video with real-time analysis...",
    })
  }

  const renderQualityBadge = (quality: TranscriptQuality | undefined) => {
    if (!quality) return null;
    
    const getColor = () => {
      switch (quality.quality) {
        case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
        case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'fair': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'poor': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };
    
    const getIcon = () => {
      switch (quality.quality) {
        case 'excellent': return <CheckCircle className="mr-1 h-3 w-3" />;
        case 'good': return <CheckCircle className="mr-1 h-3 w-3" />;
        case 'fair': return <Info className="mr-1 h-3 w-3" />;
        case 'poor': return <AlertTriangle className="mr-1 h-3 w-3" />;
        default: return <Info className="mr-1 h-3 w-3" />;
      }
    };
    
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border" style={{ fontSize: '0.65rem' }}>
        {getIcon()}
        <span className={getColor()}>
          {quality.quality.charAt(0).toUpperCase() + quality.quality.slice(1)} 
          {quality.confidence ? ` (${Math.round(quality.confidence * 100)}%)` : ''}
        </span>
      </div>
    );
  };

  const renderSummary = () => {
    if (!summary) return null;
    
    const transcriptSource = summary.transcriptSource || "youtube";
    
    return (
      <div className="space-y-6 mt-8">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
            <div className="rounded-lg overflow-hidden">
              {summary.thumbnailUrl ? (
                <img 
                  src={summary.thumbnailUrl} 
                  alt={summary.title} 
                  className="w-full h-auto"
                />
              ) : (
                <div className="bg-muted flex items-center justify-center h-48 w-full">
                  <YoutubeIcon className="h-16 w-16 text-muted-foreground opacity-50" />
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="font-semibold text-lg line-clamp-2">{summary.title}</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                <YoutubeIcon className="mr-2 h-4 w-4" />
                <span>{summary.channelName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  {formatViewCount(summary.viewCount)} views
                </div>
                <div>
                  {formatDate(summary.uploadDate)}
                </div>
                <div>
                  {formatDuration(summary.duration)}
                </div>
              </div>
            </div>
            
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {summary.topics?.map((topic: string, i: number) => (
                  <Badge key={i} variant="secondary">{topic}</Badge>
                ))}
              </div>
              
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Source: {transcriptSource === "youtube" ? "YouTube Captions" : 
                         transcriptSource === "alternative" ? "Alternative Source" : 
                         transcriptSource === "mock" ? "Demo Data" : "Unknown"}</span>
                  
                  {summary.transcriptQuality && renderQualityBadge(summary.transcriptQuality)}
                </div>
                
                {summary.transcriptQuality?.quality === 'poor' && (
                  <Alert variant="destructive" className="mt-2 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-xs">Poor transcript quality</AlertTitle>
                    <AlertDescription className="text-xs">
                      Summary may be less accurate due to transcript quality issues.
                    </AlertDescription>
                  </Alert>
                )}
                
                {summary.transcriptQuality?.quality === 'fair' && (
                  <Alert variant="warning" className="mt-2 py-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Some transcript quality issues detected. Summary accuracy may be affected.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-2/3">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="hindi" disabled={!summary.hindiSummary}>Hindi</TabsTrigger>
                <TabsTrigger value="gujarati" disabled={!summary.gujaratiSummary}>Gujarati</TabsTrigger>
                <TabsTrigger value="keypoints">Key Points</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="p-4 bg-muted/20 rounded-md mt-4">
                <h3 className="text-lg font-semibold mb-3">Video Summary</h3>
                <div className="whitespace-pre-wrap text-sm">
                  {decodeHTMLEntities(summary.summary)}
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => {
                    router.push('/video-summary');
                  }}>
                    Full Details
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="hindi" className="p-4 bg-muted/20 rounded-md mt-4">
                <h3 className="text-lg font-semibold mb-3">हिंदी सारांश (Hindi Summary)</h3>
                <div className="whitespace-pre-wrap text-sm">
                  {summary.hindiSummary ? decodeHTMLEntities(summary.hindiSummary) : "—"}
                </div>
              </TabsContent>
              
              <TabsContent value="gujarati" className="p-4 bg-muted/20 rounded-md mt-4">
                <h3 className="text-lg font-semibold mb-3">ગુજરાતી સારાંશ (Gujarati Summary)</h3>
                <div className="whitespace-pre-wrap text-sm">
                  {summary.gujaratiSummary ? decodeHTMLEntities(summary.gujaratiSummary) : "—"}
                </div>
              </TabsContent>
              
              <TabsContent value="keypoints" className="mt-4">
                <h3 className="text-lg font-semibold mb-3">Key Points</h3>
                <div className="space-y-3">
                  {summary.keyPoints?.map((point: SummaryPoint, index: number) => (
                    <div key={index} className="flex p-2 rounded-md hover:bg-muted/20">
                      <div className="flex-shrink-0 w-16 text-sm font-semibold text-muted-foreground">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            const videoId = extractVideoId(url);
                            if (videoId) {
                              // Convert timestamp to seconds if in MM:SS format
                              let seconds = 0;
                              if (point.time.includes(':')) {
                                const [minutes, secs] = point.time.split(':').map(Number);
                                seconds = minutes * 60 + secs;
                              } else {
                                seconds = parseInt(point.time);
                              }
                              window.open(
                                `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`,
                                '_blank'
                              );
                            }
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <VideoIcon className="mr-1 h-3 w-3" />
                          {point.time}
                        </Button>
                      </div>
                      <div className="ml-2 flex-grow text-sm">
                        <p>{decodeHTMLEntities(point.point)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="quality" className="mt-4 p-4 bg-muted/20 rounded-md">
                <h3 className="text-lg font-semibold mb-3">Transcript Quality Assessment</h3>
                
                {summary.transcriptQuality ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Quality:</span>
                      <Badge variant={
                        summary.transcriptQuality.quality === 'excellent' ? 'default' :
                        summary.transcriptQuality.quality === 'good' ? 'secondary' :
                        summary.transcriptQuality.quality === 'fair' ? 'outline' :
                        'destructive'
                      }>
                        {summary.transcriptQuality.quality.charAt(0).toUpperCase() + summary.transcriptQuality.quality.slice(1)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Confidence:</span>
                        <span>{Math.round(summary.transcriptQuality.confidence * 100)}%</span>
                      </div>
                      <Progress value={summary.transcriptQuality.confidence * 100} className="h-2" />
                    </div>
                    
                    {summary.transcriptQuality.issues?.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-medium">Issues detected:</span>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {summary.transcriptQuality.issues.map((issue: string, i: number) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="text-sm text-muted-foreground mt-4">
                      <p>Transcript length: {summary.transcriptLength} characters</p>
                      <p>Processed: {new Date(summary.processedAt).toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No quality assessment available for this transcript.
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={resetForm}>
                Summarize Another Video
              </Button>
              <Button onClick={() => {
                router.push('/video-summary');
              }}>
                View Full Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;
    
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Suggestions:</h3>
          <ul className="list-disc list-inside text-sm mt-2">
            <li>Make sure the video has closed captions or subtitles available</li>
            <li>Some videos have manually disabled transcripts</li>
            <li>Try a different video from a well-known creator</li>
            <li>YouTube tutorials and educational content often have good transcripts</li>
          </ul>
          
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>
              Try Another URL
            </Button>
            <Button variant="secondary" size="sm" onClick={tryDemoVideo}>
              Try Demo Video
            </Button>
          </div>
        </div>
      </Alert>
    );
  };

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">YouTube Video Summarizer</h1>
          <p className="text-muted-foreground">
            Get AI-generated summaries, key points, and topics from YouTube videos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enter YouTube URL</CardTitle>
            <CardDescription>
              Paste the URL of the YouTube video you want to summarize
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex w-full items-center space-x-2 mb-4">
              <Input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <Button type="button" size="icon" onClick={handlePaste} disabled={loading}>
                <ClipboardIcon className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm">
                    <span className="animate-spin mr-2">
                      <LoaderIcon className="h-4 w-4" />
                    </span>
                    <span>{processingStage}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelProcessing}
                    className="h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
                <Progress value={processingProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  This may take some time depending on video length and server load
                </p>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <Button onClick={handleSummarize} disabled={!url} className="w-full">
                  Generate Summary
                </Button>
                <div className="text-xs text-muted-foreground text-center">
                  Enter a YouTube video URL to get an AI-generated summary, key points, and topics covered.
                </div>
              </div>
            )}
            
            {!url && !loading && !summary && (
              <Button 
                variant="outline" 
                className="w-full mt-2"
                onClick={tryDemoVideo}
              >
                Try With Demo Video
              </Button>
            )}
          </CardContent>
        </Card>

        {renderSummary()}
        {renderError()}

        <Accordion type="single" collapsible className="mt-8">
          <AccordionItem value="faq">
            <AccordionTrigger>Frequently Asked Questions</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">How accurate are these summaries?</h3>
                  <p className="text-sm text-muted-foreground">
                    The summaries are generated based on the video's caption data. The accuracy depends on 
                    the quality of the available transcript. We provide a quality assessment to indicate 
                    potential issues that may affect accuracy.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Why can't some videos be summarized?</h3>
                  <p className="text-sm text-muted-foreground">
                    Some videos don't have captions available, or the creator has disabled access to them.
                    Our system requires transcript data to generate summaries.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Are timestamps accurate?</h3>
                  <p className="text-sm text-muted-foreground">
                    Timestamps are extracted from the transcript data and matched to the key points.
                    They should be reasonably accurate but might have small offsets depending on the video.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">How is the transcript quality determined?</h3>
                  <p className="text-sm text-muted-foreground">
                    We analyze factors like transcript length, sentence structure, repetitive patterns,
                    and other linguistic markers to assess quality. Poor quality transcripts may lead
                    to less accurate summaries.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

function decodeHTMLEntities(text: string): string {
  if (!text) return "";
  
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
} 