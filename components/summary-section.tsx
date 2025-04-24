'use client'

import { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card'
import { Loader2, Upload, FileText, Download, Copy, Share2, Bookmark, BarChart } from 'lucide-react'
import { toast } from './ui/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { useAuth } from './auth-provider'

export function SummarySection() {
  const [isUploading, setIsUploading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [documentInfo, setDocumentInfo] = useState<{
    pageCount?: number, 
    wordCount?: number,
    analytics?: {
      readingTime?: number,
      complexity?: string,
      sentenceCount?: number
    }
  } | null>(null)
  const [summaryLength, setSummaryLength] = useState<number>(12) // Increased from 8 to 12
  const [summaryTab, setSummaryTab] = useState<string>('summary')
  const [showTopics, setShowTopics] = useState<boolean>(true)
  const [originalSummaryData, setOriginalSummaryData] = useState<any>(null)
  const [isSaved, setIsSaved] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useAuth()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      })
      return
    }

    setFileName(file.name)
    setIsUploading(true)
    setSummary(null)
    setTitle(null)
    setDocumentInfo(null)
    setOriginalSummaryData(null)

    const formData = new FormData()
    formData.append('file', file)

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate summary')
      }

      const data = await response.json()
      
      if (data.success) {
        if (!data.summary || data.summary.trim() === '') {
          throw new Error('No meaningful text content found in the document.')
        }
        
        setTitle(data.title || 'Document Summary')
        setSummary(formatSummary(data.summary))
        setDocumentInfo({
          pageCount: data.pageCount,
          wordCount: data.wordCount,
          analytics: data.analytics
        })
        
        // Store the original data for customization, prioritizing mainPoints if available
        if (data.mainPoints && data.mainPoints.length > 0) {
          setOriginalSummaryData({
            ...data,
            keyPoints: data.mainPoints // Use mainPoints as keyPoints for customization
          })
        } else {
          setOriginalSummaryData(data)
        }

        // Auto-save to user history if user is logged in
        if (session?.user) {
          saveToHistory(data.title || 'Document Summary', data.summary, data.wordCount || 0);
        }
      } else {
        throw new Error(data.error || 'Failed to generate summary')
      }
    } catch (error: any) {
      console.error('Error generating summary:', error)
      
      let errorMessage = 'Failed to generate summary'
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The document might be too large or complex.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      
      // Still show a fallback summary so the user gets something useful
      if (fileName) {
        setTitle(`${fileName.split('.')[0]} (Fallback Summary)`)
        setSummary(generateFallbackSummary(fileName))
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Format the summary text for better display
  const formatSummary = (text: string | undefined): string => {
    if (!text) return '';
    
    return text
      .replace(/Key Points:/g, '<strong>Key Points:</strong>')
      .replace(/Main Topics:/g, showTopics ? '<strong>Main Topics:</strong>' : '')
      .replace(/Note:/g, '<strong>Note:</strong>')
      .replace(/\d+\.\s/g, match => `<strong>${match}</strong>`)
  }
  
  // Generate a fallback summary message if API fails
  const generateFallbackSummary = (fileName: string): string => {
    const name = fileName.split('.')[0].replace(/_/g, ' ');
    return `<strong>Key Points:</strong>
    
    <p>We couldn't generate a detailed summary for "${name}".</p>
    
    <p>Here's what you can do next:</p>
    
    <strong>1. </strong>Try uploading a smaller document (under 20 pages).
    <strong>2. </strong>Make sure the PDF contains extractable text (not scanned images).
    <strong>3. </strong>Check that the document is not password protected.
    
    <strong>Note:</strong> If you continue to have issues, please contact support for assistance.`;
  }

  const handleUploadAnother = () => {
    setSummary(null)
    setTitle(null)
    setFileName(null)
    setDocumentInfo(null)
    setOriginalSummaryData(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Copy summary to clipboard
  const copyToClipboard = () => {
    if (summary) {
      const tempElement = document.createElement('div');
      tempElement.innerHTML = summary;
      const textContent = tempElement.textContent || tempElement.innerText;
      navigator.clipboard.writeText(textContent).then(() => {
        toast({
          title: "Copied",
          description: "Summary copied to clipboard",
        });
      });
    }
  }
  
  // Customize summary length
  const updateSummaryLength = (value: number[]) => {
    const newLength = value[0];
    setSummaryLength(newLength);
    
    if (originalSummaryData && originalSummaryData.keyPoints) {
      // Re-generate summary with new length if we have original data
      const updatedKeyPoints = originalSummaryData.keyPoints.slice(0, newLength);
      let newSummary = `Key Points:\n\n`;
      
      if (showTopics && originalSummaryData.topics) {
        newSummary += `Main Topics: ${originalSummaryData.topics.join(', ')}\n\n`;
      }
      
      updatedKeyPoints.forEach((point: string, index: number) => {
        newSummary += `${index + 1}. ${point}\n\n`;
      });
      
      newSummary += 'Note: This summary was automatically generated and highlights the key information from the document.';
      setSummary(formatSummary(newSummary));
    }
  }
  
  // Toggle showing topics
  const toggleTopics = (checked: boolean) => {
    setShowTopics(checked);
    if (originalSummaryData) {
      // Re-format summary with or without topics
      setSummary(formatSummary(originalSummaryData.summary));
    }
  }

  // Function to save summary to user history
  const saveToHistory = async (summaryTitle: string, summaryText: string, wordCount: number) => {
    if (!session?.user) {
      toast({
        title: "Login Required",
        description: "Please login to save summaries to your history",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/summary/add-to-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: summaryTitle,
          summary: summaryText,
          wordCount: wordCount,
          originalText: fileName || '',
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast({
          title: "Success",
          description: "Summary saved to your history",
        });
      } else {
        throw new Error('Failed to save summary');
      }
    } catch (error) {
      console.error('Error saving summary to history:', error);
      toast({
        title: "Error",
        description: "Failed to save summary to your history",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="application/pdf"
        className="hidden"
      />
      
      {!summary ? (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Generate Document Summary</CardTitle>
            <CardDescription>
              Upload a PDF document to generate a summary of its key points
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 w-full flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
              onClick={handleButtonClick}
            >
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Processing {fileName}...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="font-medium mb-1">Click to upload a PDF</p>
                  <p className="text-sm text-muted-foreground">or drag and drop</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {fileName && (
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <FileText className="h-4 w-4 mr-1" />
                    <span>{fileName}</span>
                    {documentInfo && (
                      <span className="ml-2">
                        {documentInfo.pageCount && `${documentInfo.pageCount} pages`}
                        {documentInfo.pageCount && documentInfo.wordCount && ' • '}
                        {documentInfo.wordCount && `${documentInfo.wordCount.toLocaleString()} words`}
                      </span>
                    )}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            
            <Tabs defaultValue="summary" value={summaryTab} onValueChange={setSummaryTab} className="mx-6">
              <TabsList className="mb-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="settings">Customize</TabsTrigger>
                <TabsTrigger value="analytics" disabled={!documentInfo?.wordCount}>Analytics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary">
                <CardContent>
                  <div 
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: summary }}
                  />
                </CardContent>
              </TabsContent>
              
              <TabsContent value="settings">
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="summary-length">Points to include</Label>
                      <span className="text-sm text-muted-foreground">{summaryLength}</span>
                    </div>
                    <Slider 
                      id="summary-length"
                      min={3} 
                      max={20} 
                      step={1} 
                      value={[summaryLength]} 
                      onValueChange={updateSummaryLength}
                    />
                    <p className="text-sm text-muted-foreground">Adjust to show fewer, more focused points or more comprehensive coverage</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="show-topics" 
                      checked={showTopics} 
                      onCheckedChange={toggleTopics} 
                    />
                    <Label htmlFor="show-topics">Show main topics</Label>
                  </div>
                </CardContent>
              </TabsContent>
              
              <TabsContent value="analytics">
                <CardContent className="space-y-4">
                  <h3 className="text-lg font-medium">Document Analytics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted rounded-lg p-4 flex flex-col items-center">
                      <span className="text-4xl font-bold">{documentInfo?.pageCount || 0}</span>
                      <span className="text-sm text-muted-foreground">Pages</span>
                    </div>
                    <div className="bg-muted rounded-lg p-4 flex flex-col items-center">
                      <span className="text-4xl font-bold">{documentInfo?.analytics?.readingTime || 0}</span>
                      <span className="text-sm text-muted-foreground">Min. reading time</span>
                    </div>
                    <div className="bg-muted rounded-lg p-4 flex flex-col items-center">
                      <span className="text-4xl font-bold">{documentInfo?.wordCount?.toLocaleString() || 0}</span>
                      <span className="text-sm text-muted-foreground">Words</span>
                    </div>
                    <div className="bg-muted rounded-lg p-4 flex flex-col items-center">
                      <span className="text-4xl font-bold">{documentInfo?.analytics?.sentenceCount?.toLocaleString() || 0}</span>
                      <span className="text-sm text-muted-foreground">Sentences</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Document Complexity</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex justify-between mb-2">
                        <span>Easy</span>
                        <span>Medium</span>
                        <span>Moderate</span>
                        <span>Complex</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full relative">
                        <div 
                          className="h-2 bg-primary rounded-full absolute top-0 left-0"
                          style={{ 
                            width: (() => {
                              const complexity = documentInfo?.analytics?.complexity;
                              if (!complexity) return '0%';
                              if (complexity === 'Easy') return '25%';
                              if (complexity === 'Medium') return '50%';
                              if (complexity === 'Moderate') return '75%';
                              return '100%';
                            })()
                          }}
                        />
                      </div>
                      <div className="text-center mt-2 text-sm font-medium">
                        {documentInfo?.analytics?.complexity || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </TabsContent>
            </Tabs>
            
            <CardFooter className="flex flex-wrap gap-2 justify-end pt-2 pb-6">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Share summary</h4>
                    <p className="text-sm text-muted-foreground">Coming soon: share this summary via link or export options</p>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <Button onClick={handleUploadAnother}>
                Upload Another Document
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
} 