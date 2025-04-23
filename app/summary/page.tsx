"use client";

import { SummarySection } from "@/components/summary-section";

export default function SummaryPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Document Summary</h1>
        <p className="text-muted-foreground mt-2">
          Upload a PDF document to get an AI-generated summary of its contents
        </p>
      </div>
      <SummarySection />
    </div>
  );
} 