"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Clock, User, ArrowRight, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

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
  transcriptQuality?: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    confidence: number;
    issues: string[];
  };
  transcriptLength?: number;
  transcriptSource?: string;
  processedAt: string;
  detectedLanguage?: string;
}

export default function VideoSummaryPage() {
  const [summary, setSummary] = useState<VideoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Try to get summary data from session storage
    const summaryData = sessionStorage.getItem("videoSummary");
    
    if (summaryData) {
      try {
        const parsedData = JSON.parse(summaryData);
        if (!parsedData || !parsedData.keyPoints) {
          throw new Error("Invalid summary data format");
        }
        setSummary(parsedData);
      } catch (error) {
        console.error("Error parsing summary data:", error);
        toast({
          title: "Error",
          description: "Failed to load video summary. The data may be corrupted.",
          variant: "destructive",
        });
        
        // Clear invalid data
        sessionStorage.removeItem("videoSummary");
        sessionStorage.removeItem("lastVideoUrl");
      }
    } else {
      // If no summary data, redirect to upload page
      toast({
        title: "No summary found",
        description: "Please generate a video summary first by using the YouTube Video Summarizer",
        variant: "destructive",
      });
      
      // Short delay before redirecting to ensure toast is seen
      setTimeout(() => {
        router.push("/video-summarizer");
      }, 1500);
    }
    
    setLoading(false);
  }, [router, toast]);

  if (loading) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-8">Loading Video Summary...</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-md"></div>
            <div className="h-64 bg-muted rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="container py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">No Summary Found</h1>
          <p className="mb-8">Please generate a video summary first.</p>
          <Button onClick={() => router.push("/video-summarizer")}>
            Go to Video Summarizer
          </Button>
        </div>
      </div>
    );
  }

  const formatTime = (duration: string) => {
    // YouTube API's duration format might be in ISO 8601 format (PT1H30M15S)
    if (duration.includes('PT')) {
      const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (matches) {
        const hours = matches[1] ? parseInt(matches[1]) : 0;
        const minutes = matches[2] ? parseInt(matches[2]) : 0;
        const seconds = matches[3] ? parseInt(matches[3]) : 0;
        
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    }
    
    // If it's already in MM:SS format
    return duration;
  };

  const videoId = summary?.videoId || extractYoutubeId(sessionStorage.getItem("lastVideoUrl") || "");

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-3">{summary.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
            <div className="flex items-center">
              <User className="mr-1 h-4 w-4" />
              <span>{summary.channelName}</span>
            </div>
            <div className="flex items-center">
              <Clock className="mr-1 h-4 w-4" />
              <span>{summary.duration}</span>
            </div>
            {videoId && (
              <Link 
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-primary"
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                <span>Watch on YouTube</span>
              </Link>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {summary.topics.map((topic, index) => (
              <Badge key={index} variant="secondary">{topic}</Badge>
            ))}
          </div>
          
          <Button 
            onClick={() => router.push("/quiz-preview")}
            className="flex items-center"
          >
            Take Quiz
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Video Summary</CardTitle>
            <CardDescription>
              Key points and topics extracted from the video
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="keypoints" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="keypoints">Key Points</TabsTrigger>
                <TabsTrigger value="summary">English Summary</TabsTrigger>
                <TabsTrigger value="hindi" disabled={!summary.hindiSummary}>Hindi</TabsTrigger>
                <TabsTrigger value="gujarati" disabled={!summary.gujaratiSummary}>Gujarati</TabsTrigger>
              </TabsList>
              
              <TabsContent value="keypoints" className="space-y-4">
                <div className="space-y-3">
                  {summary.keyPoints.map((point, index) => (
                    <div key={index} className="flex">
                      <div className="flex-shrink-0 w-16 text-sm font-semibold text-muted-foreground">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
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
                          <Play className="mr-1 h-3 w-3" />
                          {point.time}
                        </Button>
                      </div>
                      <div className="ml-2 flex-grow">
                        <p>{decodeHTMLEntities(point.point)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="summary">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm font-sans p-4 bg-muted rounded-md">
                    {decodeHTMLEntities(summary.summary)}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="hindi">
                {summary.hindiSummary ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 className="text-lg font-semibold mb-2">हिंदी सारांश (Hindi Summary)</h3>
                    <pre className="whitespace-pre-wrap text-sm font-sans p-4 bg-muted rounded-md">
                      {decodeHTMLEntities(summary.hindiSummary)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-muted rounded-md text-center">
                    Hindi summary not available for this video
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="gujarati">
                {summary.gujaratiSummary ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 className="text-lg font-semibold mb-2">ગુજરાતી સારાંશ (Gujarati Summary)</h3>
                    <pre className="whitespace-pre-wrap text-sm font-sans p-4 bg-muted rounded-md">
                      {decodeHTMLEntities(summary.gujaratiSummary)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-muted rounded-md text-center">
                    Gujarati summary not available for this video
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/video-summarizer")}>
              Summarize Another Video
            </Button>
            <Button onClick={() => router.push("/quiz-preview")}>
              Take Quiz
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// Helper function to extract YouTube ID
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function decodeHTMLEntities(text: string): string {
  if (!text) return "";
  
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
} 