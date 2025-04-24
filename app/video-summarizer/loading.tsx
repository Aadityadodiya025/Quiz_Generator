import { Loader2 } from "lucide-react"

export default function VideoSummarizerLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h2 className="text-xl font-medium">Loading Video Summarizer...</h2>
      <p className="text-muted-foreground mt-2">Preparing the video summarization tools</p>
    </div>
  )
} 