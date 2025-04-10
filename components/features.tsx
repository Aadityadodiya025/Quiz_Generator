"use client"

import { Brain, FileText, BarChart3, Clock } from "lucide-react"

export function Features() {
  const features = [
    {
      icon: <FileText className="h-10 w-10 text-purple-500" />,
      title: "Upload Any Document",
      description: "Support for PDF, text files, and more. Our system extracts knowledge from your materials.",
    },
    {
      icon: <Brain className="h-10 w-10 text-pink-500" />,
      title: "AI-Powered Questions",
      description: "Advanced algorithms generate relevant questions based on your content.",
    },
    {
      icon: <Clock className="h-10 w-10 text-purple-500" />,
      title: "Adaptive Learning",
      description: "Questions adapt to your performance, focusing on areas that need improvement.",
    },
    {
      icon: <BarChart3 className="h-10 w-10 text-pink-500" />,
      title: "Detailed Analytics",
      description: "Track your progress with comprehensive performance metrics and insights.",
    },
  ]

  return (
    <div className="container py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          Our platform uses advanced AI to transform your study materials into effective quizzes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex flex-col items-center text-center p-6 rounded-lg border bg-card hover:shadow-md transition-shadow"
          >
            <div className="mb-4">{feature.icon}</div>
            <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
