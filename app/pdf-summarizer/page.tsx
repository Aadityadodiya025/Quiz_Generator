"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileIcon, ClipboardIcon, ArrowUpIcon, LoaderIcon, RefreshCw, AlertTriangle, CheckCircle, Info, AlertCircle, BookOpenIcon, FileTextIcon, DownloadIcon } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"
import { Label } from "@/components/ui/label"

interface SummaryPoint {
  page: number;
  point: string;
}

interface ExtractedPDF {
  title: string;
  numPages: number;
  summary: string;
  keyPoints: SummaryPoint[];
  topics: string[];
  processedAt: string;
  languageWarning?: string;
  extractionQuality: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    confidence: number;
    issues: string[];
  };
}

export default function PDFSummarizerPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [processingStage, setProcessingStage] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number>(0)
  const [summary, setSummary] = useState<ExtractedPDF | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Check if file is a PDF
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        toast({
          title: "Invalid file format",
          description: "Please upload a PDF file",
          variant: "destructive"
        })
        return
      }

      // Check file size (max 20MB)
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 20MB",
          variant: "destructive"
        })
        return
      }

      setFile(selectedFile)
      setError(null)
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
        description: "PDF summary generation was cancelled",
      })
    }
  }

  const handleSummarize = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please upload a PDF file",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    setSummary(null)
    setError(null)
    setProcessingStage("Uploading file...")
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
          if (progress < 20) return "Uploading file..."
          if (progress < 40) return "Extracting text from PDF..."
          if (progress < 60) return "Analyzing content..."
          if (progress < 80) return "Generating summary..."
          return "Finalizing results..."
        })
      }, 1000)

      // Create form data for file upload
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch("/api/pdf-summary", {
        method: "POST",
        body: formData,
        signal
      })

      clearInterval(progressInterval)
      setProcessingProgress(100)
      setProcessingStage("Processing complete!")

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          message: "Failed to process PDF. Please try a different file.",
        }))
        
        const errorMessage = errorData.message || "Failed to summarize PDF"
        
        setError(errorMessage)
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        })
        
        return
      }

      const data = await response.json()
      
      // Store the summary data for use in the page
      sessionStorage.setItem("pdfSummary", JSON.stringify(data))
      
      setSummary(data)

      toast({
        title: "Summary generated",
        description: "The PDF has been successfully summarized",
      })
    } catch (error: any) {
      console.error("Error summarizing PDF:", error)
      
      // Don't show error toast if it was aborted (user cancelled)
      if (error.name === 'AbortError') {
        return
      }
      
      // Display error message
      const errorMessage = error?.message || "Failed to summarize the PDF. Please try again."
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
    setFile(null)
    setSummary(null)
    setError(null)
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const tryDemoFile = () => {
    // Provide a demo summary without uploading a file
    setLoading(true)
    setSummary(null)
    setError(null)
    setProcessingStage("Loading demo file...")
    setProcessingProgress(30)
    
    setTimeout(() => {
      setProcessingProgress(60)
      setProcessingStage("Generating summary...")
      
      setTimeout(() => {
        setProcessingProgress(100)
        setProcessingStage("Processing complete!")
        
        const demoSummary: ExtractedPDF = {
          title: "Artificial Intelligence: A Modern Approach",
          numPages: 24,
          summary: "This chapter introduces the fundamental concepts of artificial intelligence (AI) and its applications across various domains. It begins by defining what AI is and explores the historical development of the field from its early philosophical foundations to modern computational approaches. The text explains different types of AI systems, including narrow (weak) AI which is designed for specific tasks, and general (strong) AI which aims to perform any intellectual task that a human can do. It describes machine learning as a subset of AI that enables systems to learn from data and improve their performance without explicit programming. The chapter also discusses neural networks and deep learning techniques that have led to significant breakthroughs in fields like computer vision and natural language processing. Important ethical considerations are addressed, including issues of privacy, bias, and the socioeconomic impacts of automation. The authors emphasize the importance of responsible AI development and deployment to ensure benefits are widely shared while minimizing potential harms.",
          keyPoints: [
            { page: 1, point: "Artificial Intelligence (AI) refers to systems that can adapt to their environment and perform tasks that would normally require human intelligence." },
            { page: 3, point: "The field of AI began in the 1950s and has experienced several cycles of optimism followed by disappointment and reduced funding, known as 'AI winters'." },
            { page: 5, point: "Machine learning is a subset of AI that focuses on algorithms that can learn from data without being explicitly programmed." },
            { page: 8, point: "Neural networks are computational models inspired by the human brain that consist of layers of interconnected nodes or 'neurons'." },
            { page: 12, point: "Deep learning involves neural networks with many layers (deep neural networks) that can learn hierarchical representations of data." },
            { page: 15, point: "Natural Language Processing (NLP) enables computers to understand, interpret, and generate human language in useful ways." },
            { page: 18, point: "Computer vision systems can analyze and interpret visual information from the world, enabling tasks like image recognition and object detection." },
            { page: 20, point: "Ethical considerations in AI include issues of bias, privacy, accountability, transparency, and the potential impact on employment." }
          ],
          topics: ["Artificial Intelligence", "Machine Learning", "Neural Networks", "Deep Learning", "Ethics", "Natural Language Processing", "Computer Vision", "Algorithms", "Data", "Intelligence"],
          processedAt: new Date().toISOString(),
          extractionQuality: {
            quality: 'excellent',
            confidence: 0.95,
            issues: []
          }
        };
        
        setSummary(demoSummary);
        setLoading(false);
        
        toast({
          title: "Demo Summary Loaded",
          description: "Showing sample summary of an AI textbook chapter",
        });
      }, 1000);
    }, 1500);
  }

  const renderQualityBadge = (quality: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    confidence: number;
    issues: string[];
  }) => {
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
    
    return (
      <div className="space-y-6 mt-8">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
            <div className="rounded-lg overflow-hidden bg-muted p-6 flex items-center justify-center">
              <FileTextIcon className="h-20 w-20 text-muted-foreground opacity-50" />
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="font-semibold text-lg line-clamp-2">{summary.title}</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                <BookOpenIcon className="mr-2 h-4 w-4" />
                <span>{summary.numPages} pages</span>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-3">
                {summary.topics?.map((topic, i) => (
                  <Badge key={i} variant="secondary">{topic}</Badge>
                ))}
              </div>
              
              <div className="text-xs text-muted-foreground mt-3">
                <div className="flex items-center justify-between">
                  <span>Extraction quality:</span>
                  {summary.extractionQuality && renderQualityBadge(summary.extractionQuality)}
                </div>
                
                {summary.extractionQuality?.quality === 'poor' && (
                  <Alert variant="destructive" className="mt-2 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-xs">Poor extraction quality</AlertTitle>
                    <AlertDescription className="text-xs">
                      Summary may be less accurate due to text extraction issues.
                    </AlertDescription>
                  </Alert>
                )}
                
                {summary.extractionQuality?.quality === 'fair' && (
                  <Alert variant="warning" className="mt-2 py-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Some text quality issues detected. Summary accuracy may be affected.
                    </AlertDescription>
                  </Alert>
                )}
                
                {summary.languageWarning && (
                  <Alert variant="warning" className="mt-2 py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {summary.languageWarning}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            
            {file && (
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const url = URL.createObjectURL(file);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name || 'document.pdf';
                    document.body.appendChild(a);
                    a.click();
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }}
                  className="w-full"
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download Original PDF
                </Button>
              </div>
            )}
          </div>
          
          <div className="w-full md:w-2/3">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="keypoints">Key Points</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="p-4 bg-muted/20 rounded-md mt-4">
                <h3 className="text-lg font-semibold mb-3">Document Summary</h3>
                <div className="whitespace-pre-wrap text-sm">
                  {summary.summary}
                </div>
              </TabsContent>
              
              <TabsContent value="keypoints" className="mt-4">
                <h3 className="text-lg font-semibold mb-3">Key Points by Page</h3>
                {summary.keyPoints && summary.keyPoints.length > 0 ? (
                  <div className="space-y-3">
                    {summary.keyPoints.map((point, index) => (
                      <div key={index} className="flex p-2 rounded-md hover:bg-muted/20">
                        <div className="flex-shrink-0 w-16 text-sm font-semibold text-muted-foreground">
                          <Badge variant="outline" className="h-6 px-2 text-xs">
                            Page {point.page}
                          </Badge>
                        </div>
                        <div className="ml-2 flex-grow text-sm">
                          <p>{point.point}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4 bg-muted/20 rounded-md">
                    No key points available for this document.
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={resetForm}>
                Process Another PDF
              </Button>
              <Button onClick={() => {
                // Copy summary to clipboard
                navigator.clipboard.writeText(summary.summary);
                toast({
                  title: "Summary copied",
                  description: "The summary has been copied to clipboard",
                });
              }}>
                <ClipboardIcon className="mr-2 h-4 w-4" />
                Copy Summary
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
        <AlertTitle>Unable to Process PDF</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        
        <div className="mt-4">
          <h3 className="text-sm font-semibold">What You Can Try:</h3>
          <ul className="list-disc list-inside text-sm mt-2">
            <li>Make sure the file is a valid PDF document</li>
            <li>Try a PDF with searchable text rather than scanned images</li>
            <li>Ensure the PDF is not encrypted or password protected</li>
            <li>Try a smaller PDF file (under 20MB)</li>
          </ul>
          
          <div className="mt-6 flex gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={resetForm}>
              <RefreshCw className="h-3 w-3 mr-2" />
              Try Another File
            </Button>
            <Button variant="secondary" size="sm" onClick={tryDemoFile} className="bg-green-600 text-white hover:bg-green-700">
              <FileIcon className="h-3 w-3 mr-2" />
              Use Demo PDF
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
          <h1 className="text-3xl font-bold mb-2">PDF Summarizer</h1>
          <p className="text-muted-foreground">
            Get AI-generated summaries, key points, and topics from PDF documents
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Document</CardTitle>
            <CardDescription>
              Upload a PDF file to generate a comprehensive summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="pdf-upload">Select PDF file</Label>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={loading}
                  className="cursor-pointer"
                />
              </div>
              
              {file && !loading && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                  </div>
                </div>
              )}

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
                    This may take some time depending on the size and complexity of your PDF
                  </p>
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  <Button onClick={handleSummarize} disabled={!file} className="w-full">
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Generate Summary
                  </Button>
                  <div className="text-xs text-muted-foreground text-center">
                    Upload a PDF document to get an AI-generated summary, key points, and topics covered.
                  </div>
                </div>
              )}
              
              {!file && !loading && !summary && (
                <Button 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={tryDemoFile}
                >
                  Try With Demo PDF
                </Button>
              )}
            </div>
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
                  <h3 className="font-medium">What types of PDFs work best?</h3>
                  <p className="text-sm text-muted-foreground">
                    PDFs with searchable text work best for summarization. These include 
                    digital documents like research papers, reports, and articles. Scanned 
                    documents may work as well but with lower accuracy.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Are my PDFs stored on your servers?</h3>
                  <p className="text-sm text-muted-foreground">
                    No, your PDFs are processed temporarily and then deleted immediately 
                    after summarization. We don't store your documents or their contents.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">How accurate are the summaries?</h3>
                  <p className="text-sm text-muted-foreground">
                    The accuracy depends on the quality of the PDF text. Documents with 
                    well-structured, searchable text will produce the most accurate 
                    summaries. Our system provides a quality assessment indicating potential 
                    issues that may affect accuracy.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">What's the maximum file size?</h3>
                  <p className="text-sm text-muted-foreground">
                    The maximum file size is 20MB. Larger documents may need to be split 
                    or compressed before uploading.
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