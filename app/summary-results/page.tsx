'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface SummaryData {
  title: string
  keyPoints: string[]
}

export default function SummaryResults() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const router = useRouter()

  useEffect(() => {
    const storedSummary = sessionStorage.getItem("generatedSummary")
    if (storedSummary) {
      setSummary(JSON.parse(storedSummary))
    } else {
      router.push("/")
    }
  }, [router])

  if (!summary) {
    return null
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{summary.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Key Points:</h2>
            <ul className="list-disc pl-6 space-y-2">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="text-muted-foreground">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex justify-center">
        <Button onClick={() => router.push("/")}>
          Generate Another Summary
        </Button>
      </div>
    </div>
  )
} 