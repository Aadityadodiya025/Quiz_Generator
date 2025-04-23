import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log("POST request received at /api/mock-summary");
  
  try {
    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // Validate file
    if (!file) {
      console.log("No file uploaded");
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log("File received:", file.name, "Size:", file.size);

    // For simplicity and reliability, create a summary based on file metadata
    const fileName = file.name || "document.pdf";
    const fileSize = file.size || 0;
    
    // Create a reliable mock summary (without trying to parse PDF)
    const summary = generateDetailedSummary(fileName, fileSize);
    console.log("Summary generated successfully");

    // Return success response
    return NextResponse.json({
      success: true,
      title: fileName.split('.')[0],
      summary: summary
    }, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json(
      { success: false, message: "Error handling request: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Function to generate a reliable detailed summary
function generateDetailedSummary(fileName: string, fileSize: number): string {
  // Extract the document name without extension
  const docName = fileName.split('.')[0];
  
  // Format file size
  const fileSizeKB = Math.round(fileSize / 1024);
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  
  // Generate topic based on filename
  const possibleTopics = [
    "information management", "data analysis", "strategic planning",
    "project development", "research methodology", "performance optimization",
    "system architecture", "knowledge transfer", "quality assessment"
  ];
  
  // Use hash of filename to select consistent topics
  const hash = simpleHash(docName);
  const topicIndex1 = hash % possibleTopics.length;
  const topicIndex2 = (hash * 13) % possibleTopics.length;
  const topicIndex3 = (hash * 31) % possibleTopics.length;
  
  const selectedTopics = [
    possibleTopics[topicIndex1],
    possibleTopics[topicIndex2 === topicIndex1 ? (topicIndex2 + 1) % possibleTopics.length : topicIndex2],
    possibleTopics[topicIndex3 === topicIndex1 || topicIndex3 === topicIndex2 ? (topicIndex3 + 2) % possibleTopics.length : topicIndex3]
  ];

  // Generate document structure based on file size
  const estimatedWordCount = Math.round(fileSize / 15); // Rough estimate
  const estimatedParagraphs = Math.max(5, Math.round(estimatedWordCount / 150));
  const documentSize = fileSizeKB > 500 ? "comprehensive" : "concise";
  
  // Generate key points
  const keyPoints = generateKeyPoints(docName, selectedTopics);
  
  // Build the summary
  return `# Summary of "${docName}"

## Overview
This document (${fileSizeMB} MB) contains approximately ${estimatedWordCount} words and appears to focus on ${selectedTopics.slice(0, 2).join(' and ')}.

## Key Points
${keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n\n')}

## Main Topics
The document frequently mentions these topics: ${selectedTopics.join(', ')}.

## Document Structure
The text is organized across approximately ${estimatedParagraphs} paragraphs, suggesting a ${documentSize} treatment of the subject.

This summary provides a high-level overview of the document's content based on available metadata.`;
}

// Generate key points based on filename and topics
function generateKeyPoints(docName: string, topics: string[]): string[] {
  const points = [
    `The document "${docName}" provides a detailed analysis of ${topics[0]} with supporting examples.`,
    `Several methodologies for implementing ${topics[1]} are discussed in depth.`,
    `The relationship between ${topics[0]} and ${topics[2]} is explored through case studies.`,
    `Key factors affecting the success of ${topics[1]} implementation are identified and analyzed.`,
    `Recommendations for improving ${topics[0]} processes are provided in the conclusion.`
  ];
  
  return points;
}

// Simple hash function for strings
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
} 