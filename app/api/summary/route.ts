import { NextRequest, NextResponse } from "next/server";
import path from "path";
import * as fs_sync from "fs";
import pdfParse from "pdf-parse";
import * as os from "os";

// Helper function to handle errors and ensure JSON response
function jsonResponse(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'of', 'if', 'it',
  'its', 'it\'s', 'that', 'than', 'then', 'this', 'these', 'those', 'what',
  'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'as', 'with',
  'from', 'into', 'during', 'including', 'until', 'against', 'among', 'throughout',
  'despite', 'towards', 'upon', 'concerning', 'about', 'over', 'before', 'after',
  'above', 'below', 'up', 'down', 'out', 'off', 'through', 'so', 'such', 'very',
  'can', 'will', 'just', 'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our',
  'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he',
  'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'they', 'them',
  'their', 'theirs', 'themselves', 'not', 'no', 'nor', 'not', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing'
]);

// Function to generate a summary from text content
function generateSummary(text: string): { summary: string, keyPoints: string[], topics: string[] } {
  // Get the main topics from the document
  const topics = extractMainTopics(text);
  
  // Get the key points/sentences - increase from 12 to 20 for more comprehensive extraction
  const keyPoints = extractKeyPoints(text, 20);
  
  // Format the summary as a structured document
  let summary = `Key Points:\n\n`;
  
  // Add main topics if available
  if (topics.length > 0) {
    summary += `Main Topics: ${topics.join(', ')}\n\n`;
  }
  
  // Add ALL key points with enhanced formatting, not just the first 8
  keyPoints.forEach((point, index) => {
    summary += `${index + 1}. ${point}\n\n`;
  });
  
  summary += 'Note: This summary was automatically generated and highlights the key information from the document.';
  
  return {
    summary,
    keyPoints,
    topics
  };
}

// Extract main topics from the document based on term frequency
function extractMainTopics(text: string): string[] {
  const cleanedText = cleanTextContent(text);
  
  // Extract both single words and common phrases
  const extractedTerms: { [term: string]: number } = {};
  
  // Get individual words, excluding stop words
  const words = cleanedText.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOP_WORDS.has(word));
  
  // Count individual words
  const wordFrequency = new Map<string, number>();
  for (const word of words) {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
  }
  
  // Convert single words to the extractedTerms object
  for (const [word, count] of wordFrequency.entries()) {
    if (count >= 2) { // Only consider words that appear at least twice
      extractedTerms[word] = count;
    }
  }
  
  // Extract common phrases (2-3 word combinations)
  const text_for_phrases = cleanedText.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words_array = text_for_phrases.split(/\s+/).filter(w => w.length > 2);
  
  // Extract 2-word phrases
  for (let i = 0; i < words_array.length - 1; i++) {
    if (STOP_WORDS.has(words_array[i])) continue;
    
    const phrase = `${words_array[i]} ${words_array[i+1]}`;
    if (phrase.length >= 7) { // Only consider meaningful phrases
      extractedTerms[phrase] = (extractedTerms[phrase] || 0) + 3; // Give phrases higher weight
    }
  }
  
  // Extract 3-word phrases
  for (let i = 0; i < words_array.length - 2; i++) {
    if (STOP_WORDS.has(words_array[i])) continue;
    
    const phrase = `${words_array[i]} ${words_array[i+1]} ${words_array[i+2]}`;
    if (phrase.length >= 10) { // Only consider meaningful phrases
      extractedTerms[phrase] = (extractedTerms[phrase] || 0) + 5; // Give longer phrases even higher weight
    }
  }
  
  // Get top terms sorted by frequency
  const sortedTerms = Object.entries(extractedTerms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Increase from 5 to 10 topics
    .map(([term]) => term.charAt(0).toUpperCase() + term.slice(1));
  
  return sortedTerms;
}

// Function to extract key points from text
function extractKeyPoints(text: string, maxPoints = 20): string[] {
  // Clean the text - remove headers, footers, and page numbers
  const cleanedText = cleanTextContent(text);
  
  // Split text into sentences
  const sentences = cleanedText
    .replace(/\n/g, ' ')
    .replace(/\.+/g, '.')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 30 && s.length < 300) // Filter out very short or very long sentences
    .filter(s => !isBoilerplateText(s)); // Filter out boilerplate text
  
  if (sentences.length === 0) {
    return ["No meaningful content found in the document."];
  }
  
  // Calculate word frequency across the document
  const wordFreq = calculateWordFrequency(cleanedText);
  
  // Score sentences based on word frequency and position
  const scoredSentences = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    let score = 0;
    for (const word of words) {
      score += wordFreq.get(word) || 0;
    }
    
    // Normalize by sentence length to avoid favoring very long sentences
    score = score / Math.max(1, words.length);
    
    // Boost score for sentences appearing early in the document (likely more important)
    const positionBoost = 1 - (index / sentences.length * 0.5); // Earlier sentences get up to 50% boost
    score *= positionBoost;
    
    // Boost sentences that appear to be statements of fact or important points
    if (/important|significant|key|critical|essential|fundamental|crucial|major|primary/i.test(sentence)) {
      score *= 1.3; // 30% boost for sentences with importance markers
    }
    
    // Boost sentences that contain numbers, which often indicate important statistics or data
    if (/\d+([.,]\d+)?%|\d+([.,]\d+)?x|\b\d+\b/g.test(sentence)) {
      score *= 1.2; // 20% boost for sentences with numbers/statistics
    }
    
    // Boost sentences that start with key phrases suggesting main points
    if (/^(the main|a key|one of the|the primary|the most|the best|the worst|the highest|the lowest)/i.test(sentence.trim())) {
      score *= 1.25; // 25% boost for sentences that appear to introduce key points
    }
    
    return { sentence, score, originalIndex: index };
  });
  
  // Sort sentences by score
  const rankedSentences = scoredSentences.sort((a, b) => b.score - a.score);
  
  // Take top N sentences by score
  const topSentencesByScore = rankedSentences.slice(0, maxPoints);
  
  // Sort selected sentences back into original document order to maintain coherence
  const orderedTopSentences = topSentencesByScore
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(item => item.sentence.trim());
  
  return orderedTopSentences;
}

// Clean text content by removing common headers, footers, page numbers
function cleanTextContent(text: string): string {
  let cleanedText = text;
  
  // Remove page numbers (standalone digits with optional whitespace)
  cleanedText = cleanedText.replace(/\n\s*\d+\s*\n/g, '\n');
  
  // Remove common footer patterns
  const footerPatterns = [
    /\d+\s*of\s*\d+/g, // Page X of Y
    /\d+\s*\/\s*\d+/g, // Page X/Y
    /www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g, // Website URLs
    /©.*\d{4}/g, // Copyright statements
    /\n.*confidential.*\n/gi, // Confidentiality notices
    /\n.*all rights reserved.*\n/gi, // Rights reserved
    /\n.*page \d+.*\n/gi, // Page X text
    /\bemail:.*@.*\.[a-z]{2,}/gi, // Email addresses
    /doi:.*\d+\.\d+\//gi, // DOI references
    /https?:\/\/\S+/g, // URLs
    /\(c\)|\(C\)|\u00A9/g, // Copyright symbols
    /^references$/gmi, // Reference section headers
    /^bibliography$/gmi, // Bibliography section headers
    /^appendix [a-z]$/gmi, // Appendix headers
    /^acknowledgements$/gmi, // Acknowledgements section
    /submitted to .* for publication/gi, // Submission notices
    /accepted for publication/gi, // Publication notices
    /\[\d+\](?=\s|$)/g, // Citation references like [1], [2], etc.
    /\(\d{4}\)(?=\s|\.)/g, // Year references in citations like (2022)
    /^figure \d+\.?/gmi, // Figure captions
    /^table \d+\.?/gmi, // Table captions
  ];
  
  footerPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });
  
  // Remove standalone line numbers (common in code examples)
  cleanedText = cleanedText.replace(/^\s*\d+[\.:]\s*(?=\S)/gm, '');
  
  // Remove excessive whitespace
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  cleanedText = cleanedText.replace(/\s{3,}/g, ' ');
  
  // Remove headers like "Abstract", "Introduction", "Conclusion", etc.
  const sectionHeaders = /^\s*(abstract|introduction|methodology|methods|results|discussion|conclusion|references|bibliography|acknowledgements)\s*$/gim;
  cleanedText = cleanedText.replace(sectionHeaders, '');
  
  return cleanedText;
}

// Check if a sentence is likely boilerplate text (headers, footers, etc.)
function isBoilerplateText(sentence: string): boolean {
  const boilerplatePatterns = [
    /copyright|all rights reserved|confidential/i,
    /^page \d+$/i,
    /^table of contents$/i,
    /^section \d+/i,
    /^chapter \d+/i,
    /\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/,
    /\d+\/\d+\/\d+/, // Dates in various formats
    /^\s*\d+\s*$/, // Just a number
  ];
  
  return boilerplatePatterns.some(pattern => pattern.test(sentence));
}

// Calculate word frequency for key terms
function calculateWordFrequency(text: string): Map<string, number> {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
  
  const frequency = new Map<string, number>();
  
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  
  return frequency;
}

// Extract a title from the PDF data
function extractTitle(fileName: string, data: pdfParse.Result): string {
  const text = data.text;
  
  // Try to find a suitable title in the first 10 lines
  const lines = text.split('\n').slice(0, 10);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine.length >= 10 && 
      trimmedLine.length <= 100 && 
      !/^\d+$/.test(trimmedLine) && 
      !trimmedLine.startsWith('http') &&
      !/^page \d+$/i.test(trimmedLine)
    ) {
      return trimmedLine;
    }
  }
  
  // If no suitable title found, use the filename without extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
  return nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check if the request method is POST
  if (request.method !== 'POST') {
    return jsonResponse({ 
      success: false, 
      error: 'Method not allowed' 
    }, 405);
  }
  
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    // Check if a file was provided
    if (!file) {
      return jsonResponse({ 
        success: false, 
        error: 'No file uploaded' 
      }, 400);
    }
    
    // Check if the file is a PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return jsonResponse({ 
        success: false, 
        error: 'Only PDF files are supported' 
      }, 400);
    }
    
    // Create a temporary file to store the uploaded PDF
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, file.name);
    
    // Convert the file to buffer and write to temp file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs_sync.writeFileSync(tempFilePath, fileBuffer);
    
    // Parse the PDF file
    let pdfData;
    try {
      pdfData = await pdfParse(fileBuffer);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      return jsonResponse({ 
        success: false, 
        error: 'Unable to parse PDF file. The file may be corrupted, password-protected, or contain only scanned images.' 
      }, 400);
    }
    
    // Check if we got text content
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return jsonResponse({ 
        success: false, 
        error: 'No extractable text found in the PDF. The document may contain only images or scanned content.' 
      }, 400);
    }
    
    // Extract title and generate summary
    const title = extractTitle(file.name, pdfData);
    const summaryData = generateSummary(pdfData.text);
    
    // Validate the generated summary
    if (!summaryData.summary || summaryData.summary.length < 50) {
      return jsonResponse({
        success: false,
        error: 'Unable to generate a meaningful summary from this document. The content may be too short or not suitable for summarization.'
      }, 400);
    }
    
    // Delete the temporary file
    try {
      fs_sync.unlinkSync(tempFilePath);
    } catch (error) {
      console.error('Error deleting temporary file:', error);
    }
    
    // Return the enhanced response with mainPoints as a dedicated field
    return jsonResponse({
      success: true,
      title,
      summary: summaryData.summary,
      mainPoints: summaryData.keyPoints, // Explicit field for main points
      keyPoints: summaryData.keyPoints,  // Keep for backward compatibility
      topics: summaryData.topics,
      pageCount: pdfData.numpages, 
      wordCount: countWords(pdfData.text),
      analytics: {
        readingTime: Math.round(countWords(pdfData.text) / 220), // Average reading time in minutes
        complexity: calculateComplexity(pdfData.text),
        sentenceCount: countSentences(pdfData.text)
      }
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return jsonResponse({ 
      success: false, 
      error: 'An unexpected error occurred while processing the document' 
    }, 500);
  }
}

// Count the total words in the document
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

// Count the total sentences in the document
function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
}

// Calculate document complexity based on word length, sentence length, etc.
function calculateComplexity(text: string): string {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  
  if (words.length === 0 || sentences.length === 0) {
    return "Unknown";
  }
  
  // Average word length
  const avgWordLength = words.join('').length / words.length;
  
  // Average sentence length in words
  const avgSentenceLength = words.length / sentences.length;
  
  // Simple complexity algorithm
  const complexityScore = (avgWordLength * 0.4) + (avgSentenceLength * 0.6);
  
  // Categorize complexity
  if (complexityScore < 4.5) return "Easy";
  if (complexityScore < 6.5) return "Medium";
  if (complexityScore < 8.5) return "Moderate";
  return "Complex";
} 