import { NextRequest, NextResponse } from "next/server";
import * as pdfjs from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { Readable } from "stream";
import { finished } from "stream/promises";
import { writeFile } from "fs/promises";
import path from "path";
import fs from "fs";
import os from "os";

// Load PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Define response types
interface SummaryPoint {
  page: number;
  point: string;
}

interface PdfSummaryResponse {
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

// Function to extract text from PDF
async function extractTextFromPDF(filePath: string): Promise<string[]> {
  try {
    const pdf = await pdfjs.getDocument(filePath).promise;
    const numPages = pdf.numPages;
    const pagesText: string[] = [];
    
    console.log(`PDF loaded successfully. Total pages: ${numPages}`);
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      // Extract text items and join them
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      pagesText.push(pageText);
      
      // If the text is very short, it might be an image-based PDF
      // We'll handle this with OCR in a separate function
      if (pageText.length < 50 && i <= 3) {
        console.log(`Page ${i} has very little text (${pageText.length} chars). Might need OCR.`);
      }
    }
    
    return pagesText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

// Fallback OCR for image-based PDFs
async function performOCROnPDF(filePath: string): Promise<string[]> {
  try {
    const pdf = await pdfjs.getDocument(filePath).promise;
    const numPages = pdf.numPages;
    const pagesText: string[] = [];
    
    // Create temporary directory for images
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
    
    // Initialize Tesseract OCR worker
    const worker = await createWorker('eng');
    
    for (let i = 1; i <= Math.min(numPages, 20); i++) { // Limit to 20 pages for performance
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 }); // Higher scale for better OCR
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context!,
        viewport,
      }).promise;
      
      // Save canvas as image
      const imgPath = path.join(tempDir, `page-${i}.png`);
      const imgData = canvas.toDataURL('image/png').replace(/^data:image\/\w+;base64,/, '');
      await writeFile(imgPath, Buffer.from(imgData, 'base64'));
      
      // Perform OCR on the image
      const { data } = await worker.recognize(imgPath);
      pagesText.push(data.text);
      
      // Clean up image file
      await fs.promises.unlink(imgPath);
    }
    
    // Terminate OCR worker
    await worker.terminate();
    
    // Clean up temp directory
    await fs.promises.rmdir(tempDir);
    
    return pagesText;
  } catch (error) {
    console.error("Error performing OCR on PDF:", error);
    throw new Error("Failed to perform OCR on PDF");
  }
}

// Assess text quality
function assessTextQuality(text: string[]): {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  confidence: number;
  issues: string[];
} {
  const issues = [];
  const totalText = text.join(' ');
  const wordCount = totalText.split(/\s+/).length;
  
  // Check for very short text
  if (wordCount < 100) {
    issues.push("Very little text was extracted from the PDF");
  }
  
  // Check for OCR artifacts
  const ocrArtifacts = /[|]{3,}|[.]{5,}|[_]{3,}|[\d]{10,}/.test(totalText);
  if (ocrArtifacts) {
    issues.push("OCR artifacts detected in extracted text");
  }
  
  // Check for broken words
  const brokenWordsRatio = totalText.split(/\b[a-z]{1,2}\b/).length / wordCount;
  if (brokenWordsRatio > 0.1) {
    issues.push("Many broken or fragmented words detected");
  }
  
  // Calculate confidence based on issues
  let confidence = 1.0;
  if (issues.length > 0) confidence -= issues.length * 0.15;
  
  // Ensure confidence is between 0 and 1
  confidence = Math.max(0.3, Math.min(confidence, 1.0));
  
  // Determine quality level
  let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
  if (confidence < 0.5) quality = 'poor';
  else if (confidence < 0.7) quality = 'fair';
  else if (confidence < 0.9) quality = 'good';
  
  return { quality, confidence, issues };
}

// Improved summary generation
function generateSummary(pagesText: string[]): {
  summary: string;
  keyPoints: SummaryPoint[];
  topics: string[];
} {
  // Implement advanced summarization logic here
  // For now, we'll use a simplified version
  
  const fullText = pagesText.join(' ');
  const sentences = fullText
    .replace(/([.?!])\s+/g, "$1|")
    .split("|")
    .filter(s => s.length > 20);
  
  // Find important sentences for the summary
  const importantSentences = sentences
    .filter(sentence => {
      // Criteria for importance
      const containsNumbers = /\d+/.test(sentence);
      const containsKeyPhrases = /important|significant|key|finding|result|conclude|analysis|determine|reveal|show|demonstrate|indicate/i.test(sentence);
      const properLength = sentence.length > 50 && sentence.length < 200;
      
      return (containsNumbers || containsKeyPhrases) && properLength;
    })
    .slice(0, 12); // Limit to 12 important sentences
  
  // Generate summary
  let summary = importantSentences.join(' ');
  
  // If summary is too short, use first few sentences from different pages
  if (summary.length < 200) {
    const pageSentences = pagesText.map(pageText => {
      const pageSent = pageText
        .replace(/([.?!])\s+/g, "$1|")
        .split("|")
        .filter(s => s.length > 30);
      return pageSent.length > 0 ? pageSent[0] : "";
    }).filter(s => s.length > 0);
    
    summary = pageSentences.join(' ');
  }
  
  // Extract key points (one from each page, if possible)
  const keyPoints: SummaryPoint[] = [];
  
  pagesText.forEach((pageText, index) => {
    if (pageText.length < 50) return; // Skip nearly empty pages
    
    const pageSentences = pageText
      .replace(/([.?!])\s+/g, "$1|")
      .split("|")
      .filter(s => s.length > 30);
    
    if (pageSentences.length === 0) return;
    
    // Find the most important sentence on this page
    let bestSentence = pageSentences[0];
    for (const sentence of pageSentences) {
      if (/important|significant|key|finding|result|conclude/i.test(sentence)) {
        bestSentence = sentence;
        break;
      }
    }
    
    keyPoints.push({
      page: index + 1,
      point: bestSentence.trim()
    });
  });
  
  // Extract topics
  const words = fullText.toLowerCase().split(/\W+/);
  const wordCounts: Record<string, number> = {};
  
  // Count word frequencies, excluding common words
  for (const word of words) {
    if (word.length < 4) continue; // Skip short words
    if (/^(the|and|this|that|with|from|have|they|their|what|when|where|there|these|those|then|than|been|were|would|could|should)$/i.test(word)) continue;
    
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }
  
  // Convert to array and sort by frequency
  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(entry => entry[0]);
  
  // Filter to reasonable topics and capitalize
  const topics = sortedWords
    .filter(word => word.length > 3 && !/^\d+$/.test(word))
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .slice(0, 10);
  
  return { summary, keyPoints, topics };
}

// Function to extract title from PDF
async function extractTitleFromPDF(filePath: string, pagesText: string[]): Promise<string> {
  try {
    // First, try to get metadata from the PDF
    const data = await pdfjs.getDocument(filePath).promise;
    const metadata = await data.getMetadata();
    
    if (metadata && metadata.info && metadata.info.Title) {
      return metadata.info.Title;
    }
    
    // If metadata doesn't have title, try to extract from first page
    if (pagesText.length > 0) {
      const firstPage = pagesText[0];
      
      // Look for possible title patterns
      const lines = firstPage.split(/\n/).map(line => line.trim());
      
      // If first line is reasonably short, it might be a title
      if (lines.length > 0 && lines[0].length > 0 && lines[0].length < 100) {
        return lines[0];
      }
      
      // Try to find a line that looks like a title (all caps, etc.)
      for (const line of lines.slice(0, 5)) {
        if (line.toUpperCase() === line && line.length > 10 && line.length < 100) {
          return line;
        }
      }
      
      // Fall back to first sentence
      const firstSentence = firstPage.split(/[.!?]/, 1)[0].trim();
      if (firstSentence.length > 10 && firstSentence.length < 100) {
        return firstSentence;
      }
    }
    
    // If all else fails, use filename
    const fileName = path.basename(filePath, path.extname(filePath));
    return fileName || "Untitled Document";
    
  } catch (error) {
    console.error("Error extracting title:", error);
    return "Untitled Document";
  }
}

// Save uploaded file
async function saveUploadedFile(formData: FormData): Promise<string> {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error("No file uploaded");
  }
  
  // Validate file type
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error("Only PDF files are supported");
  }
  
  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create a unique filename
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const filePath = path.join(tempDir, fileName);
  
  // Convert File to buffer and save
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  await writeFile(filePath, buffer);
  console.log(`File saved to ${filePath}`);
  
  return filePath;
}

// Cleanup temp file
async function cleanupTempFile(filePath: string) {
  try {
    await fs.promises.unlink(filePath);
    console.log(`Temporary file ${filePath} deleted`);
  } catch (error) {
    console.error("Error cleaning up temp file:", error);
  }
}

export async function POST(request: NextRequest) {
  // Create temp directory if needed
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // For storing the uploaded file path
  let uploadedFilePath = "";
  
  try {
    const formData = await request.formData();
    
    // Save uploaded file
    uploadedFilePath = await saveUploadedFile(formData);
    
    // Process the PDF
    console.log("Extracting text from PDF...");
    let pagesText = await extractTextFromPDF(uploadedFilePath);
    
    // Check if PDF has enough text
    const totalText = pagesText.join(' ');
    if (totalText.length < 200) {
      console.log("PDF appears to be image-based. Trying OCR...");
      try {
        pagesText = await performOCROnPDF(uploadedFilePath);
      } catch (ocrError) {
        console.error("OCR failed:", ocrError);
        // Continue with the text we have, even if it's minimal
      }
    }
    
    // Extract title
    const title = await extractTitleFromPDF(uploadedFilePath, pagesText);
    
    // Assess text quality
    const extractionQuality = assessTextQuality(pagesText);
    
    // Generate summary, key points, and topics
    const { summary, keyPoints, topics } = generateSummary(pagesText);
    
    // Prepare response
    const response: PdfSummaryResponse = {
      title,
      numPages: pagesText.length,
      summary,
      keyPoints,
      topics,
      processedAt: new Date().toISOString(),
      extractionQuality
    };
    
    // Clean up temporary file
    await cleanupTempFile(uploadedFilePath);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error("Error processing PDF:", error);
    
    // Clean up temporary file in case of error
    if (uploadedFilePath) {
      await cleanupTempFile(uploadedFilePath).catch(e => console.error("Error cleaning up:", e));
    }
    
    return NextResponse.json(
      { 
        message: error.message || "Error processing PDF file",
        error: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      }, 
      { status: 500 }
    );
  }
} 