// API route for file uploads
import { NextRequest, NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import * as pdfParse from "pdf-parse"
import * as fs from "fs"
import * as os from "os"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Define quiz question type for better type checking
interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number | number[]; // Can be a single index or array of indices for MSQ
  type: "single" | "multiple"; // Type of question: single-select or multiple-select
  difficulty: DifficultyLevel;
}

/**
 * Difficulty level type: easy, medium, or hard
 * This affects both the number and complexity of questions generated:
 * - EASY: Fewer questions (5-7), more straightforward wording
 *   - createMCQQuestions: 7 questions
 *   - createExamQuestions: 5 questions 
 *   - createMultipleSelectQuestions: 2 questions
 * 
 * - MEDIUM: Moderate number of questions (10-12), more nuanced wording
 *   - createMCQQuestions: 12 questions
 *   - createExamQuestions: 10 questions
 *   - createMultipleSelectQuestions: 3 questions
 * 
 * - HARD: More questions (15-18), more challenging wording and distractors
 *   - createMCQQuestions: 18 questions
 *   - createExamQuestions: 15 questions
 *   - createMultipleSelectQuestions: 5 questions
 */
type DifficultyLevel = "easy" | "medium" | "hard";

// Configure the API route
export const config = {
  api: {
    bodyParser: false
  }
}

/**
 * POST handler for PDF upload API
 * Processes uploaded PDF files and generates quiz questions based on content
 * @param request - The incoming request containing the PDF file and difficulty setting
 * @returns JSON response with generated quiz or error message
 */
export async function POST(request: NextRequest) {
  console.log("PDF upload API called");
  
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('file') as File;
    
    // The difficulty level determines the number and complexity of questions generated
    // - easy: fewer, simpler questions (typically 5-7)
    // - medium: moderate number of standard questions (typically 8-12)
    // - hard: more questions with increased complexity (typically 12-15)
    // This is used in createMCQQuestions, createExamQuestions, and createMultipleSelectQuestions
    const difficulty = (formData.get('difficulty') as string || 'medium') as DifficultyLevel;
    
    // Validate the file
    if (!pdfFile) {
      return NextResponse.json({ data: null, error: 'No file uploaded' }, { status: 400 });
    }
    
    if (!pdfFile.name.endsWith('.pdf')) {
      return NextResponse.json({ data: null, error: 'Uploaded file is not a PDF' }, { status: 400 });
    }
    
    if (pdfFile.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ data: null, error: 'File size exceeds 10MB limit' }, { status: 400 });
    }
    
    console.log(`Processing PDF: ${pdfFile.name}, size: ${pdfFile.size} bytes, difficulty: ${difficulty}`);
    
    // Save the file temporarily
    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a unique filename
    const filename = `${Date.now()}_${pdfFile.name.replace(/\s+/g, '_')}`;
    const filePath = join(os.tmpdir(), filename);
    
    try {
      // Save the file to disk temporarily
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved PDF temporarily to: ${filePath}`);
    } catch (fileWriteError) {
      console.error("Error saving temporary file:", fileWriteError);
      return NextResponse.json({ 
        data: null,
        error: 'FILE_STORAGE_ERROR',
        message: 'Failed to save the uploaded file for processing. Please try again.' 
      }, { status: 500 });
    }
    
    // Extract text from the PDF
    let pdfText = '';
    try {
      console.log("Starting PDF text extraction...");
      const startTime = Date.now();
      pdfText = await extractTextFromPdf(filePath);
      const endTime = Date.now();
      console.log(`PDF extraction completed in ${endTime - startTime}ms, extracted ${pdfText.length} characters`);
      
      // Clean up the temporary file
      fs.unlinkSync(filePath);
      console.log("Temporary PDF file deleted");
      
      if (!pdfText || pdfText.length < 200) {
        console.error("Extracted text is too short or empty:", pdfText);
        return NextResponse.json({ 
          data: null,
          error: 'PDF_EMPTY',
          message: 'Could not extract sufficient text from the PDF. Please ensure the PDF contains readable text and is not image-based or empty.' 
        }, { status: 400 });
      }
    } catch (error: any) {
      console.error("PDF extraction error:", error);
      let errorMessage = 'Failed to extract text from PDF';
      let errorCode = 'FILE_PROCESSING_ERROR';
      
      // Provide more specific error messages based on common PDF issues
      if (error.message.includes("PDF_EMPTY") || error.message.includes("empty")) {
        errorMessage = 'The PDF file appears to be empty or contains no extractable text. Please ensure it has actual text content, not just images.';
        errorCode = 'PDF_EMPTY';
      } else if (error.message.includes("INSUFFICIENT_TEXT_CONTENT")) {
        errorMessage = 'The PDF contains too little text to generate meaningful questions. Please upload a document with more content.';
        errorCode = 'INSUFFICIENT_TEXT_CONTENT';
      } else if (error.message.includes("PDF_PROTECTED") || error.message.includes("password")) {
        errorMessage = 'The PDF is password protected. Please remove the password and try again.';
        errorCode = 'PDF_PROTECTED';
      } else if (error.message.includes("PDF_PROCESSING_TIMEOUT") || error.message.includes("timeout")) {
        errorMessage = 'PDF processing timed out. The file may be too large or complex.';
        errorCode = 'PDF_PROCESSING_TIMEOUT';
      } else if (error.message.includes("corrupt") || error.message.includes("invalid") || error.message.includes("INVALID_PDF")) {
        errorMessage = 'The PDF file appears to be corrupted or invalid.';
        errorCode = 'INVALID_PDF';
      }
      
      // Clean up the temporary file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Temporary PDF file deleted after error");
      }
      
      return NextResponse.json({ data: null, error: errorCode, message: errorMessage }, { status: 400 });
    }

    // Clean and process the extracted text
    console.log("Cleaning extracted text...");
    const originalLength = pdfText.length;
    const cleanedText = cleanPdfText(pdfText);
    console.log(`Text cleaned: ${originalLength} chars → ${cleanedText.length} chars`);
    
    if (cleanedText.length < 200) {
      return NextResponse.json({ 
        data: null,
        error: 'INSUFFICIENT_TEXT_CONTENT',
        message: 'The extracted content is too short to generate meaningful questions.' 
      }, { status: 400 });
    }
    
    // Generate quiz questions from the text
    console.log("Generating quiz questions...");
    
    try {
      // Divide text into chunks for processing
      const chunks = divideTextIntoChunks(cleanedText);
      console.log(`Divided text into ${chunks.length} chunks`);
      
      if (chunks.length < 3) {
        return NextResponse.json({
          data: null,
          error: 'INSUFFICIENT_TEXT_STRUCTURE',
          message: 'The document does not have enough distinct sections to generate varied questions.'
        }, { status: 400 });
      }
      
      // Extract key facts from the text
      const keyFacts = extractKeyFacts(chunks);
      console.log(`Extracted ${keyFacts.length} key facts`);
      
      if (keyFacts.length < 5) {
        return NextResponse.json({
          data: null,
          error: 'INSUFFICIENT_FACTS',
          message: 'Could not extract enough key facts from the document to generate meaningful questions.'
        }, { status: 400 });
      }
      
      // Generate quiz questions based on PDF content
      console.log("Generating MCQ questions...");
      const mcqQuestions = createMCQQuestions(chunks, keyFacts, difficulty);
      
      console.log("Generating multiple-select questions...");
      const msqQuestions = createMultipleSelectQuestions(chunks, keyFacts, difficulty);
      
      console.log("Generating exam-style questions...");
      const examQuestions = createExamQuestions(keyFacts, pdfText, 10, difficulty);
      
      console.log("Generating true/false questions...");
      const tfQuestions = createTrueFalseQuestions(keyFacts, pdfText, difficulty);
      
      console.log(`Generated ${mcqQuestions.length} MCQ questions`);
      console.log(`Generated ${msqQuestions.length} multiple-select questions`);
      console.log(`Generated ${examQuestions.length} exam-style questions`);
      console.log(`Generated ${tfQuestions.length} true/false questions`);
      
      // Check if we were able to generate enough questions
      const totalQuestions = mcqQuestions.length + msqQuestions.length + examQuestions.length + tfQuestions.length;
      if (totalQuestions === 0) {
        return NextResponse.json({
          data: null,
          error: 'QUESTION_GENERATION_FAILED',
          message: 'Failed to generate any questions from this document. The content may not be suitable for quiz generation.'
        }, { status: 400 });
      }
      
      if (totalQuestions < 3) {
        return NextResponse.json({
          data: null,
          error: 'INSUFFICIENT_QUESTIONS',
          message: 'Could only generate a few questions from this document. Please upload content with more facts and information.'
        }, { status: 400 });
      }
      
      // Combine all questions and shuffle
      let allQuestions = [
        ...mcqQuestions,
        ...msqQuestions,
        ...examQuestions,
        ...tfQuestions
      ].map((q, index) => ({
        ...q,
        id: index + 1
      }));
      
      // Filter out low-quality questions with validation
      allQuestions = allQuestions.filter(question => {
        // Reject questions that are too short or unclear
        if (!question.question || question.question.length < 10) {
          return false;
        }
        
        // Reject questions with duplicate options
        const uniqueOptions = new Set(question.options.map(opt => opt.toLowerCase().trim()));
        if (uniqueOptions.size < question.options.length) {
          return false;
        }
        
        // Reject questions with empty or very short options
        if (question.options.some(opt => !opt || opt.length < 5)) {
          return false;
        }
        
        // For multiple-select questions, ensure there's more than one correct answer
        if (question.type === "multiple" && 
            (!Array.isArray(question.answer) || question.answer.length < 1)) {
          return false;
        }
        
        // For single-select questions, ensure the answer index is valid
        if (question.type === "single" && 
            (typeof question.answer !== 'number' || 
             question.answer < 0 || 
             question.answer >= question.options.length)) {
          return false;
        }
        
        // Check that options are different enough from each other
        let tooSimilar = false;
        for (let i = 0; i < question.options.length; i++) {
          for (let j = i + 1; j < question.options.length; j++) {
            if (calculateSimilarity(
                question.options[i].toLowerCase(),
                question.options[j].toLowerCase()
              ) > 0.8) {
              tooSimilar = true;
              break;
            }
          }
          if (tooSimilar) break;
        }
        if (tooSimilar) return false;
        
        // Validate that the correct answer(s) are properly identified
        if (question.type === "single") {
          const correctOption = question.options[question.answer as number];
          // Check if the correct answer has a contradiction word which would make it obviously wrong
          if (correctOption.match(/\b(never|not|cannot|impossible|incorrect|wrong|false|untrue)\b/i) &&
              !question.question.match(/\b(not|false|incorrect|negative)\b/i)) {
            return false;
          }
        }
        
        return true;
      });
      
      // Final quality check - re-verify that answers are valid after filtering
      allQuestions = allQuestions.map(question => {
        // For single-choice questions
        if (question.type === "single") {
          const answerIndex = question.answer as number;
          // If the answer index is invalid, find the most likely correct answer
          if (answerIndex < 0 || answerIndex >= question.options.length) {
            // Default to first option if we can't determine
            return { ...question, answer: 0 };
          }
        } 
        // For multiple-choice questions
        else if (question.type === "multiple") {
          const answerIndices = question.answer as number[];
          // Filter out invalid indices
          const validIndices = answerIndices.filter(idx => 
            typeof idx === 'number' && idx >= 0 && idx < question.options.length
          );
          
          // If we lost all valid indices, default to first option
          if (validIndices.length === 0) {
            return { ...question, answer: [0] };
          }
          
          return { ...question, answer: validIndices };
        }
        
        return question;
      });
      
      // Ensure a reasonable number of questions based on difficulty
      const maxQuestions = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15;
      if (allQuestions.length > maxQuestions) {
        // Prioritize questions with clear, specific content
        const rankedQuestions = [...allQuestions].sort((a, b) => {
          // Prioritize diverse question types
          if (a.type !== b.type) {
            // Ensure a good mix of multiple-choice and single-choice questions
            if (a.type === "multiple") return -1;
            if (b.type === "multiple") return 1;
          }
          
          // Prioritize questions with specific details (numbers, dates, proper nouns)
          const aHasDetails = /\d+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b[A-Z][a-z]+ [A-Z][a-z]+\b/i.test(a.question);
          const bHasDetails = /\d+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b[A-Z][a-z]+ [A-Z][a-z]+\b/i.test(b.question);
          
          if (aHasDetails && !bHasDetails) return -1;
          if (!aHasDetails && bHasDetails) return 1;
          
          // Prioritize questions of reasonable length
          return b.question.length - a.question.length;
        });
        
        // Ensure diversity in question types
        const examCount = Math.min(examQuestions.length, Math.ceil(maxQuestions / 2));
        const msqCount = Math.min(msqQuestions.length, Math.ceil(maxQuestions / 4));
        const mcqCount = Math.min(mcqQuestions.length, Math.floor(maxQuestions / 4));
        const tfCount = Math.min(tfQuestions.length, Math.max(1, maxQuestions - examCount - msqCount - mcqCount));
        
        // Select questions ensuring diversity
        const selectedExamQs = rankedQuestions.filter(q => examQuestions.some(eq => eq.id === q.id)).slice(0, examCount);
        const selectedMsqQs = rankedQuestions.filter(q => msqQuestions.some(mq => mq.id === q.id)).slice(0, msqCount);
        const selectedMcqQs = rankedQuestions.filter(q => mcqQuestions.some(mq => mq.id === q.id)).slice(0, mcqCount);
        const selectedTfQs = rankedQuestions.filter(q => tfQuestions.some(tf => tf.id === q.id)).slice(0, tfCount);
        
        // Combine all selected questions
        allQuestions = [...selectedExamQs, ...selectedMsqQs, ...selectedMcqQs, ...selectedTfQs];
        
        // If we still need more questions, add highest-ranked questions of any type
        if (allQuestions.length < maxQuestions) {
          const existingIds = new Set(allQuestions.map(q => q.id));
          const remainingQuestions = rankedQuestions.filter(q => !existingIds.has(q.id));
          allQuestions = [
            ...allQuestions,
            ...remainingQuestions.slice(0, maxQuestions - allQuestions.length)
          ];
        }
      }
      
      // Final step: Reassign IDs and ensure questions are properly formatted
      allQuestions = allQuestions.map((question, index) => ({
        ...question,
        id: index + 1,
        question: formatQuestionText(question.question),
        options: question.options.map(opt => formatOptionText(opt))
      }));
      
      // Success! Return the generated quiz data
      console.log(`Successfully generated ${allQuestions.length} quiz questions`);
      
      return NextResponse.json({
        data: {
          questions: allQuestions,
          title: pdfFile.name.replace(/\.pdf$/i, ''),
          sourceDocument: pdfFile.name,
          totalQuestions: allQuestions.length,
          estimatedTime: Math.ceil(allQuestions.length * 1.5), // 1.5 minutes per question
          difficulty: difficulty,
          generatedAt: new Date().toISOString()
        }
      });
      
    } catch (questionGenError) {
      console.error("Error during question generation:", questionGenError);
      
      return NextResponse.json({ 
        data: null,
        error: 'QUESTION_GENERATION_ERROR',
        message: 'An error occurred while generating questions from your document.',
        details: questionGenError instanceof Error ? questionGenError.message : String(questionGenError)
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Unhandled error in PDF upload API:", error);
    
    // Capture stack trace and detailed error information
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : String(error);
    
    console.error("Error details:", JSON.stringify(errorDetails, null, 2));
    
    // Return a more informative error response
    return NextResponse.json({ 
      data: null,
      error: 'FILE_PROCESSING_ERROR',
      message: 'An unexpected error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    }, { status: 500 });
  }
}

/**
 * Safe PDF parsing with improved error handling and fallbacks
 * This function tries multiple approaches to extract text from PDFs
 */
async function safePdfParse(buffer: Buffer, options = {}): Promise<any> {
  // First, try the standard parsing
  try {
    console.log("Attempting standard PDF parsing...");
    return await pdfParse(buffer, options);
  } catch (error) {
    console.error("Standard PDF parsing failed:", error);
    
    if (error.message && error.message.includes("password")) {
      throw new Error("PDF_PROTECTED");
    }
    
    // If standard parsing fails, try with more limited options
    try {
      console.log("Attempting fallback PDF parsing with limited options...");
      // Use more conservative options
      const limitedOptions = {
        ...options,
        max: 50,  // Limit to fewer pages
        version: "default" // Use default version handling
      };
      return await pdfParse(buffer, limitedOptions);
    } catch (secondError) {
      console.error("Fallback PDF parsing failed:", secondError);
      
      // Last attempt - try parsing with minimal processing
      try {
        console.log("Attempting minimal PDF parsing as last resort...");
        // Most basic options to just get any text
        const minimalOptions = {
          max: 20, // Very limited pages
          pagerender: undefined, // No custom rendering
          // @ts-ignore
          timeout: 30000 // Short timeout
        };
        return await pdfParse(buffer, minimalOptions);
      } catch (finalError) {
        console.error("All PDF parsing attempts failed:", finalError);
        
        // Check for specific errors
        const errMsg = finalError.message || "";
        if (errMsg.includes("corrupt") || errMsg.includes("invalid")) {
          throw new Error("INVALID_PDF");
        } else if (errMsg.includes("timeout")) {
          throw new Error("PDF_PROCESSING_TIMEOUT");
        } else {
          throw new Error(`PDF_PROCESSING_ERROR: ${errMsg}`);
        }
      }
    }
  }
}

/**
 * Enhanced text extraction that handles PDFs with unusual layouts
 * This adds post-processing of the raw PDF text to make it more usable
 */
function enhanceExtractedText(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }
  
  console.log("Enhancing extracted text...");
  
  // Replace form feed characters that can break processing
  let enhanced = text.replace(/\f/g, '\n\n');
  
  // Handle common PDF issues:
  
  // 1. Fix hyphenated words at line breaks (common in PDFs)
  enhanced = enhanced.replace(/(\w+)-\n(\w+)/g, '$1$2');
  
  // 2. Fix bullets and numbered lists that get separated
  enhanced = enhanced.replace(/(?:\r?\n|\r)(\s*[•○◦▪▫◘■□▬●])(\s*)/g, ' $1$2');
  enhanced = enhanced.replace(/(?:\r?\n|\r)(\s*\d+\.)(\s*)/g, ' $1$2');
  
  // 3. Remove headers/footers with page numbers that repeat
  // (This is a simplified approach - more complex patterns may need custom regex)
  const pageNumberPatterns = [
    /\n\s*Page \d+ of \d+\s*\n/g,
    /\n\s*\d+\s*\n/g, // Standalone page numbers
    /\n\s*-\s*\d+\s*-\s*\n/g // Page numbers with dashes
  ];
  
  for (const pattern of pageNumberPatterns) {
    enhanced = enhanced.replace(pattern, '\n');
  }
  
  // 4. Fix paragraphs broken across pages - join sentences
  enhanced = enhanced.replace(/(\w)\.?\n(\w)/g, '$1. $2');
  
  // 5. Fix excessive whitespace
  enhanced = enhanced.replace(/[ \t]{2,}/g, ' ');
  enhanced = enhanced.replace(/\n{3,}/g, '\n\n');
  
  // 6. Attempt to detect and preserve section headers by keeping them on their own lines
  const potentialHeaderRegex = /\n([A-Z][A-Z\s]{3,}[A-Z])\n/g;
  enhanced = enhanced.replace(potentialHeaderRegex, '\n\n$1\n\n');
  
  // 7. Fix merged sentences (missing spaces after periods)
  enhanced = enhanced.replace(/(\w)\.(\w)/g, '$1. $2');
  
  console.log("Text enhancement complete");
  return enhanced;
}

// Update extractTextFromPdf to use the enhancer
async function extractTextFromPdf(filePath: string): Promise<string> {
  let dataBuffer;
  
  // Read the file with proper error handling
  try {
    dataBuffer = fs.readFileSync(filePath);
    console.log(`Successfully read file: ${filePath}, size: ${dataBuffer.length} bytes`);
  } catch (readError) {
    console.error(`Error reading PDF file ${filePath}:`, readError);
    throw new Error(`Failed to read PDF file: ${readError.message}`);
  }
  
  try {
    // Verify the buffer has content
    if (!dataBuffer || dataBuffer.length === 0) {
      console.error("PDF buffer is empty");
      throw new Error("PDF_EMPTY");
    }
    
    console.log(`Parsing PDF of size ${dataBuffer.length} bytes`);
    
    // Use our safe parsing function with extended options
    const pdfData = await safePdfParse(dataBuffer, {
      max: 100, // Process up to 100 pages
      // @ts-ignore
      timeout: 90000, // Increased timeout to 90 seconds
    });
    
    // Validate that we actually got meaningful text
    if (!pdfData.text) {
      console.error("PDF extraction returned null or undefined text");
      throw new Error("PDF_EMPTY");
    }
    
    const textLength = pdfData.text.trim().length;
    if (textLength < 100) {
      console.error(`PDF extraction returned insufficient text: ${textLength} characters`);
      throw new Error("PDF_EMPTY");
    }
    
    // Apply enhanced text processing to improve quality
    const enhancedText = enhanceExtractedText(pdfData.text);
    
    console.log(`Successfully extracted ${pdfData.text.length} characters from PDF (enhanced: ${enhancedText.length})`);
    return enhancedText;
  } catch (error) {
    // Re-throw specialized errors
    if (error.message.startsWith("PDF_") || 
        error.message.includes("INVALID_PDF")) {
      throw error;
    }
    
    // For other errors, provide more context
    console.error("PDF extraction error details:", error);
    throw new Error(`PDF_PROCESSING_ERROR: ${error.message}`);
  }
}

/**
 * Cleans extracted PDF text to improve processing
 * Enhanced to handle encoding issues and special characters
 */
function cleanPdfText(text: string): string {
  try {
    console.log("Starting text cleaning...");
    
    // Handle potential encoding issues
    let cleanedText = text
      // Convert potential Unicode issues
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') 
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Replace tabs with spaces
      .replace(/\t/g, ' ')
      // Remove extra spaces
      .replace(/ {2,}/g, ' ')
      // Allow a wider range of useful characters but remove problematic ones
      .replace(/[^\w\s.,;:?!()[\]{}'"«»""''&@#$%^*+=-]/g, '')
      // Join broken sentences
      .replace(/\n([a-z])/g, ' $1');
      
    // Post-process checks to handle edge cases
    if (cleanedText.length < 50 && text.length > 200) {
      console.warn("Cleaning removed too much text, trying more permissive cleaning");
      
      // More permissive cleaning for edge cases
      cleanedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{5,}/g, '\n\n\n')
        .replace(/\t/g, ' ')
        .replace(/ {3,}/g, '  ');
    }
    
    // Log a sample of the cleaned text for debugging
    console.log(`Cleaned text sample (first 200 chars): ${cleanedText.substring(0, 200)}`);
    console.log(`Text length before: ${text.length}, after: ${cleanedText.length}`);
    
    // Additional validation
    if (cleanedText.length < 200) {
      console.error("Cleaned text is too short for meaningful processing:", cleanedText);
      throw new Error("INSUFFICIENT_TEXT_CONTENT");
    }
    
    return cleanedText;
  } catch (error) {
    console.error("Error during text cleaning:", error);
    
    // If cleaning fails, but we have original text, return a basic cleaned version
    if (text && text.length > 200) {
      console.log("Returning basic cleaned version after cleaning error");
      return text.substring(0, 100000).replace(/[^\w\s.,;:?!()[\]{}]/g, '');
    }
    
    throw new Error("TEXT_CLEANING_FAILED");
  }
}

/**
 * Divides text into manageable chunks for processing
 * Enhanced to better identify logical sections and meaningful content
 */
function divideTextIntoChunks(text: string): string[] {
  console.log("Dividing text into chunks...");
  
  // Try to identify section headers and structured content
  const potentialSectionHeaders = text.match(/\n([A-Z][A-Z\s\d]{2,}[A-Z\d])\s*\n/g) || [];
  
  if (potentialSectionHeaders.length >= 3) {
    console.log(`Detected ${potentialSectionHeaders.length} potential section headers`);
    
    // If we found section headers, split by them for more meaningful chunks
    const sections = text.split(/\n[A-Z][A-Z\s\d]{2,}[A-Z\d]\s*\n/);
    
    // Filter out very short sections that might just be artifacts
    const validSections = sections.filter(section => section.trim().length > 100);
    
    if (validSections.length >= 3) {
      console.log(`Using ${validSections.length} document sections as chunks`);
      return validSections;
    }
  }
  
  // If no sections detected, try standard paragraph breaks
  let paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 30);
  
  // If we have enough paragraphs, use them
  if (paragraphs.length >= 5) {
    console.log(`Using ${paragraphs.length} paragraphs as chunks`);
    return paragraphs;
  }
  
  // Try to split by line breaks followed by capital letters (common in many PDFs)
  console.log("Few paragraphs detected, trying alternative chunking strategies");
  paragraphs = text.split(/\n(?=[A-Z])/).filter(p => p.trim().length > 30);
  
  // If still too few, combine sentences into meaningful chunks
  if (paragraphs.length < 5) {
    console.log("Still few chunks, splitting by sentences and recombining");
    
    // Extract all sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const chunks: string[] = [];
    let currentChunk = '';
    
    // Group sentences into chunks of reasonable size
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > 500) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    paragraphs = chunks;
  }
  
  // Ensure chunks aren't too large by splitting very long ones
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length > 1000) {
      // Split very large paragraphs
      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + 800, paragraph.length);
        // Try to find a period, question mark, or exclamation point to break at
        let breakPoint = paragraph.substring(start, end).search(/[.!?]\s/);
        if (breakPoint === -1 || breakPoint < 200) {
          // If no good break point, just use the calculated end
          breakPoint = end - start;
        } else {
          // Add 2 to include the punctuation and space
          breakPoint += 2;
        }
        result.push(paragraph.substring(start, start + breakPoint));
        start += breakPoint;
      }
    } else {
      result.push(paragraph);
    }
  }
  
  console.log(`Divided text into ${result.length} chunks`);
  return result;
}

/**
 * Extracts key facts from text chunks with improved accuracy
 * Enhanced to identify structured information and key concepts
 */
function extractKeyFacts(chunks: string[]): string[] {
  console.log("Extracting key facts from text chunks...");
  const facts: string[] = [];
  const processedSentences = new Set<string>(); // Track processed sentences to avoid duplicates
  
  // Look for definition patterns first (high-quality facts)
  const definitionPatterns = [
    /([A-Z][a-z]+(?:\s+[a-z]+){0,6})\s+(?:is|are|refers to|means|represents|defines)\s+([^.!?]+)/gi,
    /([A-Z][a-z]+(?:\s+[a-z]+){0,6})\s+(?:can be defined as|is defined as|is considered to be)\s+([^.!?]+)/gi
  ];
  
  // Extract definitions from all chunks
  for (const chunk of chunks) {
    for (const pattern of definitionPatterns) {
      let match;
      while ((match = pattern.exec(chunk)) !== null) {
        const subject = match[1].trim();
        const definition = match[2].trim();
        
        // Skip very short definitions or generic subjects
        if (definition.length < 20 || subject.length < 3) continue;
        if (subject.match(/^(The|This|That|These|Those|It|He|She|They|We)$/i)) continue;
        
        const fact = `${subject} is ${definition}.`;
        if (!processedSentences.has(fact.toLowerCase())) {
          facts.push(fact);
          processedSentences.add(fact.toLowerCase());
        }
      }
    }
  }
  
  console.log(`Extracted ${facts.length} definition facts`);
  
  // Extract sentences that are likely to contain facts
  for (const chunk of chunks) {
    // Split into sentences with improved regex that handles various punctuation
    const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // Skip if we've already processed this sentence
      if (processedSentences.has(trimmed.toLowerCase())) continue;
      processedSentences.add(trimmed.toLowerCase());
      
      // Skip sentences that are too short, too long, or don't look like facts
      if (trimmed.length < 30 || trimmed.length > 300) continue;
      
      // Include sentences that are likely to contain factual information
      if (
        // Sentences with key indicators of factual content
        /is|are|was|were|has|have|can|will|should|may|must|defined as|refers to|consist of|comprises|means|represents|indicates|signifies|equals|involves|contains|includes/i.test(trimmed) &&
        // Not questions (unless rhetorical questions that provide information)
        (!trimmed.endsWith('?') || (trimmed.endsWith('?') && /is defined as|is known as|refers to/i.test(trimmed))) &&
        // Not uncertain statements
        !/might|maybe|perhaps|probably|possibly|could be|may be|seems to be|appears to be/i.test(trimmed) &&
        // Contains good content indicators (numbers, technical terms, proper nouns)
        (/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|\d+%|\d+\s+[a-z]+|\b[A-Z][a-zA-Z]*[0-9]+[a-zA-Z0-9]*/i.test(trimmed) ||
         /\b(process|system|method|technique|concept|theory|principle|function|structure|component|element|factor)\b/i.test(trimmed))
      ) {
        facts.push(trimmed);
      }
    }
  }
  
  // Look for comparison patterns - these make good facts
  const comparisonPatterns = [
    /([^.!?]+) compared to ([^.!?]+)/gi,
    /([^.!?]+) differs from ([^.!?]+)/gi,
    /([^.!?]+) versus ([^.!?]+)/gi,
    /([^.!?]+) in contrast to ([^.!?]+)/gi
  ];
  
  for (const chunk of chunks) {
    for (const pattern of comparisonPatterns) {
      let match;
      while ((match = pattern.exec(chunk)) !== null) {
        const comparisonSentence = match[0].trim();
        if (comparisonSentence.length > 30 && comparisonSentence.length < 300) {
          if (!processedSentences.has(comparisonSentence.toLowerCase())) {
            facts.push(comparisonSentence);
            processedSentences.add(comparisonSentence.toLowerCase());
          }
        }
      }
    }
  }
  
  // If we didn't find enough facts with the first pass, use less strict criteria
  if (facts.length < 10) {
    console.log("Found fewer than 10 facts, using less strict criteria...");
    for (const chunk of chunks) {
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [];
      
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        
        // Skip if we've already processed this sentence or it's already included
        if (processedSentences.has(trimmed.toLowerCase()) || facts.includes(trimmed)) continue;
        processedSentences.add(trimmed.toLowerCase());
        
        // Less strict criteria for facts
        if (
          trimmed.length >= 40 && 
          trimmed.length <= 300 && 
          !trimmed.endsWith('?') &&
          /\b[A-Z][a-z]+\b/.test(trimmed) // Contains at least one proper noun
        ) {
          facts.push(trimmed);
        }
      }
    }
  }
  
  console.log(`Extracted ${facts.length} total facts`);
  
  // Filter out redundant facts (facts that are subsets of other facts)
  const uniqueFacts = facts.filter((fact, i) => {
    for (let j = 0; j < facts.length; j++) {
      if (i !== j && facts[j].includes(fact) && facts[j].length > fact.length * 1.3) {
        return false; // This fact is a subset of another fact
      }
    }
    return true;
  });
  
  console.log(`After removing redundancies: ${uniqueFacts.length} unique facts`);
  
  // If we still have very few facts, log a warning
  if (uniqueFacts.length < 5) {
    console.warn("Extracted very few unique facts. PDF may have formatting issues or insufficient content.");
  }
  
  return uniqueFacts;
}

/**
 * Creates multiple-choice questions from text chunks and facts
 */
function createMCQQuestions(chunks: string[], facts: string[], difficulty: DifficultyLevel): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  
  // Add logging to track facts and chunks
  console.log(`Creating MCQ questions from ${facts.length} facts and ${chunks.length} chunks`);
  console.log("Sample facts:", facts.slice(0, 2));
  console.log("Sample chunk:", chunks[0]?.substring(0, 100));
  
  // Determine number of questions to generate based on difficulty
  const questionsToGenerate = 
    difficulty === 'easy' ? 7 : 
    difficulty === 'medium' ? 12 : 
    18;
  
  // Create different types of questions from the facts
  const factQuestions = createFactualQuestions(facts, difficulty);
  console.log(`Generated ${factQuestions.length} factual questions`);
  
  // Use up to 70% of slots for fact-based questions (increased from 50%)
  const maxFactQuestions = Math.floor(questionsToGenerate * 0.7);
  const selectedFactQuestions = factQuestions.slice(0, Math.min(factQuestions.length, maxFactQuestions));
  
  questions.push(...selectedFactQuestions);
  
  // If we need more questions, create from chunks
  if (questions.length < questionsToGenerate) {
    const definitionQuestions = createDefinitionQuestions(chunks, difficulty);
    console.log(`Generated ${definitionQuestions.length} definition questions`);
    questions.push(...definitionQuestions.slice(0, questionsToGenerate - questions.length));
  }
  
  // Add comparison questions if we still need more
  if (questions.length < questionsToGenerate) {
    const comparisonQuestions: QuizQuestion[] = [];
    createComparisonQuestions(chunks, comparisonQuestions);
    console.log(`Generated ${comparisonQuestions.length} comparison questions`);
    questions.push(...comparisonQuestions.slice(0, questionsToGenerate - questions.length));
  }
  
  // Final validation - ensure all questions have exactly 4 options
  return questions.map(question => {
    // Skip questions that already have exactly 4 options
    if (question.options.length === 4) {
      return question;
    }
    
    // Extract the subject from the question text
    const questionWords = question.question.split(' ');
    const subject = questionWords.slice(0, Math.min(3, questionWords.length)).join(' ');
    
    // Ensure we have exactly 4 options
    if (question.options.length > 4) {
      // If we have too many, keep the correct answer and 3 others
      const correctOption = question.options[question.answer as number];
      let otherOptions = question.options.filter((_, index) => index !== (question.answer as number));
      // Shuffle and take first 3
      otherOptions = shuffleArray(otherOptions).slice(0, 3);
      
      // Combine and shuffle again
      const newOptions = shuffleArray([correctOption, ...otherOptions]);
      // Find new index of correct answer
      const newAnswerIndex = newOptions.indexOf(correctOption);
      
      return {
        ...question,
        options: newOptions,
        answer: newAnswerIndex
      };
    } else if (question.options.length < 4) {
      // If we have too few, add generic options
      const additionalOptions = [
        `A different aspect of ${subject} not mentioned in the text.`,
        `An alternative interpretation of ${subject}.`,
        `A common misconception about ${subject}.`,
        `A theoretical approach to ${subject} not used in practice.`
      ];
      
      // Filter out any that are too similar to existing options
      const filteredAdditional = additionalOptions.filter(newOpt => 
        !question.options.some(existingOpt => 
          calculateSimilarity(newOpt.toLowerCase(), existingOpt.toLowerCase()) > 0.6
        )
      );
      
      // Add unique options until we have 4
      const newOptions = [...question.options];
      for (let i = 0; i < filteredAdditional.length && newOptions.length < 4; i++) {
        newOptions.push(filteredAdditional[i]);
      }
      
      // If we still don't have 4, add numbered alternatives
      while (newOptions.length < 4) {
        newOptions.push(`Alternative ${newOptions.length + 1}: Another perspective on ${subject}.`);
      }
      
      // Ensure the answer index is preserved
      return {
        ...question,
        options: newOptions,
        answer: question.answer as number // Preserve the original answer index
      };
    }
    
    // This should never happen (we've handled all cases above)
    return question;
  });
}

/**
 * Creates definition-based questions
 */
function createDefinitionQuestions(chunks: string[], difficulty: DifficultyLevel): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const maxQuestions = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 8;
  
  // Process each chunk
  for (const chunk of chunks) {
    if (questions.length >= maxQuestions) break;
    
    // Extract definition sentences
    const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [];
    
    for (const sentence of sentences) {
      if (questions.length >= maxQuestions) break;
      
      const trimmed = sentence.trim();
      
      // Look for definition patterns
      if (/\b(is|are|refers to|defined as|means|denotes)\b.*\b(as|to be|a|an|the)\b/i.test(trimmed) && 
          trimmed.length > 40 && trimmed.length < 150) {
        
        // Extract subject and definition
        const match = trimmed.match(/(\w+(?:\s+\w+){0,3})\s+(is|are|refers to|defined as|means|denotes)\b/i);
        
        if (match) {
          const subject = match[1].trim();
          
          if (subject.length > 2 && !subject.match(/^(it|this|that|these|those|he|she|they)$/i)) {
            // Create question text
            const questionText = `What is the best definition of ${subject}?`;
            
            // Correct answer
            const correctAnswer = trimmed;
            
            // Generate distractors
            const distractors = generateDistractors(chunks, subject, correctAnswer, 3);
            
            if (distractors.length >= 3) {
              // Add the question
              const options = [correctAnswer, ...distractors];
              
              questions.push({
                id: 0, // Will be assigned later
                question: questionText,
                options: shuffleArray(options),
                answer: options.indexOf(correctAnswer),
                type: "single",
                difficulty: difficulty
              });
            }
          }
        }
      }
    }
  }
  
  return questions;
}

/**
 * Creates factual questions based on extracted facts with improved accuracy and clarity
 */
function createFactualQuestions(facts: string[], difficulty: DifficultyLevel): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const maxQuestions = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 12;
  const processedSubjects = new Set<string>(); // Track subjects to avoid redundant questions
  
  // Sort facts by length and quality to prioritize more detailed and substantive facts
  const sortedFacts = [...facts]
    .filter(fact => fact.length >= 40 && fact.length <= 300) // Skip too short or too long facts
    .sort((a, b) => {
      // Prioritize facts with specific details (numbers, dates, proper names)
      const aHasDetails = /\d+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b[A-Z][a-z]+ [A-Z][a-z]+\b/i.test(a);
      const bHasDetails = /\d+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b[A-Z][a-z]+ [A-Z][a-z]+\b/i.test(b);
      
      if (aHasDetails && !bHasDetails) return -1;
      if (!aHasDetails && bHasDetails) return 1;
      
      // Then prioritize facts of optimal length (neither too short nor too long)
      const aOptimalLength = a.length >= 60 && a.length <= 150;
      const bOptimalLength = b.length >= 60 && b.length <= 150;
      
      if (aOptimalLength && !bOptimalLength) return -1;
      if (!aOptimalLength && bOptimalLength) return 1;
      
      // Default to longer facts
      return b.length - a.length;
    });
  
  // Extract common subjects to create better contextual questions
  const subjectFrequency = new Map<string, number>();
  
  // Process each fact
  for (const fact of sortedFacts) {
    if (questions.length >= maxQuestions) break;
    
    // Skip facts that are too complex or confusing
    if (fact.split(/[,.;:]/).length > 5) continue; // Too many clauses
    
    // Find subject-verb-object patterns
    let questionCreated = false;
    
    // Parse the fact to identify subject, verb, object structure
    const words = fact.split(/\s+/);
    
    // Skip very short facts
    if (words.length < 6) continue;
    
    // Strategy 1: Look for clear subject-verb patterns (X is Y, A has B, etc.)
    for (let i = 0; i < words.length - 3; i++) {
      if (questions.length >= maxQuestions) break;
      
      // Find a subject noun phrase (1-3 words)
      const maxSubjectLength = Math.min(3, words.length - i - 2); // Ensure we have room for verb and object
      
      for (let subjectLength = maxSubjectLength; subjectLength > 0; subjectLength--) {
        if (i + subjectLength >= words.length - 1) continue; // Need room for verb and object
        
        const subject = words.slice(i, i + subjectLength).join(' ');
        
        // Skip if subject is a common pronoun or very short
        if (subject.match(/^(it|this|that|these|those|he|she|they|we|you|I|a|an|the)$/i) || 
            subject.length < 3) {
          continue;
        }
        
        // Track subject frequency to identify important topics
        const normalizedSubject = subject.toLowerCase();
        subjectFrequency.set(normalizedSubject, (subjectFrequency.get(normalizedSubject) || 0) + 1);
        
        // Check if we've already created a question for this subject
        // but allow multiple questions on key subjects (higher frequency)
        const subjectFreq = subjectFrequency.get(normalizedSubject) || 0;
        if (processedSubjects.has(normalizedSubject) && subjectFreq < 3) {
          continue;
        }
        
        // Identify the verb following the subject
        const verb = words[i + subjectLength];
        
        // Skip if the verb isn't a common linking or action verb
        if (!verb.match(/^(is|are|was|were|has|have|can|does|do|provides|gives|offers|contains|includes|enables|allows|creates|produces|leads|results|consists|depends|requires)$/i)) {
          continue;
        }
        
        // Extract the rest of the fact as the answer part
        const factPart = words.slice(i + subjectLength + 1).join(' ');
        if (factPart.length < 15) continue; // Skip if the fact part is too short
        
        // Create factual question based on difficulty
        let questionText;
        
        switch (difficulty) {
          case "easy":
            // For easy questions, use direct what/who/how questions
            if (subject.match(/^[A-Z]/)) { // Proper noun - likely a person, place, or specific entity
              questionText = `What ${verb} ${subject}?`;
            } else if (verb.match(/^(is|are|was|were)$/i)) {
              questionText = `What ${verb} ${subject}?`;
            } else if (verb.match(/^(has|have)$/i)) {
              questionText = `What does ${subject} ${verb}?`;
            } else {
              questionText = `How does ${subject} ${verb} ${factPart.split(' ').slice(0, 2).join(' ')}...?`;
            }
            break;
            
          case "medium":
            // For medium difficulty, use slightly more complex question formats
            if (verb.match(/^(is|are|was|were)$/i)) {
              questionText = `Which of the following correctly describes ${subject}?`;
            } else if (verb.match(/^(has|have)$/i)) {
              questionText = `What characteristic ${verb} ${subject}?`;
            } else if (verb.match(/^(provides|gives|offers|contains|includes)$/i)) {
              questionText = `What does ${subject} ${verb}?`;
            } else {
              questionText = `Which statement about ${subject} is accurate?`;
            }
            break;
            
          case "hard":
            // For hard difficulty, use more sophisticated analysis questions
            if (verb.match(/^(is|are)$/i) && factPart.length > 40) {
              questionText = `Which analysis of ${subject} is most accurate?`;
            } else if (factPart.includes('because') || factPart.includes('due to') || 
                       factPart.includes('as a result') || factPart.includes('therefore')) {
              questionText = `Which explanation regarding ${subject} is correct?`;
            } else if (verb.match(/^(depends|requires|needs|influences|affects)$/i)) {
              questionText = `What relationship exists between ${subject} and other elements?`;
            } else {
              questionText = `Which statement accurately represents the properties of ${subject}?`;
            }
            break;
        }
        
        // Format the question text for clarity
        questionText = formatQuestionText(questionText);
        
        // Create the correct answer (the original fact)
        const correctAnswer = formatOptionText(`${subject} ${verb} ${factPart}`);
        
        // Generate distractors (incorrect options)
        const distractors = generateFactDistractors(facts, subject, verb, factPart, 3);
        
        // Only create the question if we could generate enough distractors
        if (distractors.length >= 3) {
          // Create options array with correct answer and distractors
          const options = [correctAnswer, ...distractors];
          
          // Add the question
          questions.push({
            id: 0, // Will be assigned later
            question: questionText,
            options: shuffleArray(options.map(opt => formatOptionText(opt))),
            answer: 0, // The first option before shuffling was the correct answer
            type: "single",
            difficulty: difficulty
          });
          
          // Mark this subject as processed
          processedSubjects.add(normalizedSubject);
          
          // Set flag to avoid creating multiple questions from the same fact
          questionCreated = true;
          break;
        }
      }
      
      if (questionCreated) break; // Move to next fact if we created a question
    }
    
    // Strategy 2: If no clear subject-verb-object pattern was found, try a different approach for fact-based questions
    if (!questionCreated) {
      // Try to identify proper nouns or important terminology
      const properNouns = [];
      const terminology = [];
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Identify proper nouns (capitalized words not at the start of a sentence)
        if (i > 0 && word.match(/^[A-Z][a-z]{2,}/)) {
          // Check if it's part of a multi-word proper noun
          let properNoun = word;
          let j = i + 1;
          while (j < words.length && words[j].match(/^[A-Z][a-z]*/)) {
            properNoun += " " + words[j];
            j++;
          }
          
          if (!properNouns.includes(properNoun)) {
            properNouns.push(properNoun);
          }
        }
        
        // Identify potential terminology (words 5+ characters not in common word list)
        if (word.length >= 5 && !word.match(/^(about|above|across|after|again|against|along|among|around|because|before|behind|below|beneath|beside|between|beyond|during|except|inside|outside|through|toward|under|within|without)$/i)) {
          if (!terminology.includes(word) && !properNouns.includes(word)) {
            terminology.push(word);
          }
        }
      }
      
      // Create questions based on identified proper nouns or terminology
      if (properNouns.length > 0 || terminology.length > 0) {
        // Choose a term to focus the question on
        const focusTerm = properNouns.length > 0 ? 
          properNouns[Math.floor(Math.random() * properNouns.length)] : 
          terminology[Math.floor(Math.random() * terminology.length)];
        
        // Skip if we've already processed this term
        if (processedSubjects.has(focusTerm.toLowerCase())) {
          continue;
        }
        
        // Create question text based on the term and difficulty
        let questionText;
        
        if (difficulty === "easy") {
          questionText = `Which statement about ${focusTerm} is correct?`;
        } else if (difficulty === "medium") {
          questionText = `What is true regarding ${focusTerm}?`;
        } else {
          questionText = `Which analysis of ${focusTerm} is most accurate?`;
        }
        
        // Format the question for clarity
        questionText = formatQuestionText(questionText);
        
        // The correct answer is the original fact
        const correctAnswer = formatOptionText(fact);
        
        // Generate diverse distractors
        const distractors = [];
        
        // Use other facts that mention the same term but alter them
        const relatedFacts = facts.filter(f => 
          f !== fact && f.includes(focusTerm) && calculateSimilarity(f, fact) < 0.7
        );
        
        if (relatedFacts.length > 0) {
          // Use an altered version of a related fact
          const relatedFact = relatedFacts[Math.floor(Math.random() * relatedFacts.length)];
          distractors.push(createFalseStatement(relatedFact, facts, ''));
        }
        
        // Add general distractors about the term
        distractors.push(`${focusTerm} is frequently misunderstood and its importance has been exaggerated in many contexts.`);
        distractors.push(`${focusTerm} has limited applicability and is only relevant in specific circumstances.`);
        
        // Add one more specific distractor
        if (properNouns.length > 1) {
          // Use another proper noun to create confusion
          const otherNoun = properNouns.find(noun => noun !== focusTerm);
          if (otherNoun) {
            distractors.push(`${focusTerm} and ${otherNoun} are interchangeable terms that refer to the same concept.`);
          }
        } else {
          distractors.push(`${focusTerm} represents a theoretical concept that has not been validated in practical applications.`);
        }
        
        // Format and ensure we have unique options
        const options = [correctAnswer, ...distractors.map(formatOptionText)];
        
        // Add the question
        questions.push({
          id: 0, // Will be assigned later
          question: questionText,
          options: shuffleArray(options),
          answer: 0, // The first option (before shuffling) was the correct answer
          type: "single",
          difficulty: difficulty
        });
        
        // Mark this term as processed
        processedSubjects.add(focusTerm.toLowerCase());
      }
    }
  }
  
  // Return the generated questions with unique IDs
  return questions.map((question, index) => ({
    ...question,
    id: index + 1
  }));
}

/**
 * Generates distractor options for definition questions
 */
function generateDistractors(chunks: string[], subject: string, correctAnswer: string, count: number): string[] {
  const distractors: string[] = [];
  
  // Extract other possible definitions from the chunks
  for (const chunk of chunks) {
    const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // Skip the correct answer
      if (trimmed === correctAnswer) continue;
      
      // Look for sentences that might work as distractors
      if (
        /\b(is|are|refers to|defined as|means|denotes)\b/i.test(trimmed) &&
        !trimmed.includes(subject) && // Avoid using the subject in distractors
        trimmed.length > 30 && trimmed.length < 150 &&
        // Avoid sentences that are too similar to the correct answer
        calculateSimilarity(trimmed, correctAnswer) < 0.5
      ) {
        distractors.push(trimmed);
      }
    }
  }
  
  // If we don't have enough distractors, create synthetic ones
  if (distractors.length < count) {
    // Create synthetic distractors
    const words = correctAnswer.split(/\s+/);
    
    for (let i = 0; i < 5 && distractors.length < count; i++) {
      // Modify the correct answer by changing some words
      const modifiedWords = [...words];
      
      // Change 2-3 words depending on length
      const changesToMake = words.length > 10 ? 3 : 2;
      
      for (let j = 0; j < changesToMake; j++) {
        const index = Math.floor(Math.random() * words.length);
        if (modifiedWords[index] && modifiedWords[index].length > 3) {
          modifiedWords[index] = getAntonymOrAlternative(modifiedWords[index]);
        }
      }
      
      const distractor = modifiedWords.join(' ');
      
      // Check if it's different enough
      if (calculateSimilarity(distractor, correctAnswer) < 0.7) {
        distractors.push(distractor);
      }
    }
  }
  
  // Return unique distractors
  return [...new Set(distractors)].slice(0, count);
}

/**
 * Generates high-quality distractor options for factual questions
 */
function generateFactDistractors(
  facts: string[],
  subject: string,
  verb: string,
  factPart: string,
  count: number
): string[] {
  const distractors: string[] = [];
  
  // Track core phrases to avoid duplicate content
  const usedPhrases = new Set<string>();
  // Add the correct answer to avoid similar distractors
  usedPhrases.add(factPart.toLowerCase().trim());
  
  // Extract keywords from the fact part to avoid using them
  const keywords = factPart
    .split(/\s+/)
    .filter(word => word.length > 4 && !['about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'because', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'except', 'inside', 'outside', 'through', 'toward', 'under', 'within', 'without'].includes(word.toLowerCase()))
    .map(word => word.toLowerCase().replace(/[^\w]/g, ''));
  
  // Track the semantic types of distractors to ensure variety
  const distractorTypes = [];
  
  // Approaches for generating varied, plausible, but incorrect distractors
  const approaches = [
    // Type 1: Use factoids from other parts of text but alter them to be incorrect
    () => {
      const otherFacts = facts.filter(f => !f.includes(subject) || calculateSimilarity(f, factPart) < 0.4);
      if (otherFacts.length === 0) return null;
      
      // Pick a random fact and extract a relevant part
      const randomFact = otherFacts[Math.floor(Math.random() * otherFacts.length)];
      const parts = randomFact.split(/[,.:;]/);
      if (parts.length === 0) return null;
      
      const selectedPart = parts[Math.floor(Math.random() * parts.length)].trim();
      // Only use if it's a reasonable length and not too similar to correct answer
      if (selectedPart.length < 5 || selectedPart.length > 100) return null;
      if (calculateSimilarity(selectedPart.toLowerCase(), factPart.toLowerCase()) > 0.5) return null;
      
      // Check if this phrase has already been used
      const key = selectedPart.toLowerCase().trim();
      if (usedPhrases.has(key)) return null;
      usedPhrases.add(key);
      
      return selectedPart;
    },
    
    // Type 2: Create logical opposites or alternatives with negation or antonyms
    () => {
      // Extract key descriptive words that could be negated or replaced
      const descriptors = factPart.match(/\b(high|low|large|small|increase|decrease|more|less|many|few|important|significant|effective|ineffective)\b/gi);
      if (!descriptors || descriptors.length === 0) return null;
      
      // Replace with opposite meaning
      let altered = factPart;
      for (const descriptor of descriptors) {
        const antonym = getAntonymOrAlternative(descriptor);
        if (antonym && antonym !== descriptor) {
          altered = altered.replace(new RegExp(`\\b${descriptor}\\b`, 'gi'), antonym);
          break; // Only replace one descriptor to keep it plausible
        }
      }
      
      // Only use if we actually changed something
      if (altered === factPart) return null;
      
      // Check if this phrase has already been used
      const key = altered.toLowerCase().trim();
      if (usedPhrases.has(key)) return null;
      usedPhrases.add(key);
      
      return altered;
    },
    
    // Type 3: Create a statement that confuses cause and effect
    () => {
      if (!factPart.includes('because') && !factPart.includes('due to') && !factPart.includes('results in')) {
        return null;
      }
      
      let altered = factPart;
      
      // Reverse cause and effect relationships
      if (factPart.includes('because')) {
        const parts = factPart.split('because');
        if (parts.length !== 2) return null;
        altered = `${parts[1].trim()} because ${parts[0].trim()}`;
      } else if (factPart.includes('due to')) {
        const parts = factPart.split('due to');
        if (parts.length !== 2) return null;
        altered = `${parts[1].trim()} leads to ${parts[0].trim()}`;
      } else if (factPart.includes('results in')) {
        const parts = factPart.split('results in');
        if (parts.length !== 2) return null;
        altered = `${parts[1].trim()} produces ${parts[0].trim()}`;
      }
      
      // Only use if we actually changed something and it's different enough
      if (altered === factPart || calculateSimilarity(altered.toLowerCase(), factPart.toLowerCase()) > 0.7) {
        return null;
      }
      
      // Check if this phrase has already been used
      const key = altered.toLowerCase().trim();
      if (usedPhrases.has(key)) return null;
      usedPhrases.add(key);
      
      return altered;
    },
    
    // Type 4: Create a plausible but incorrect numeric variation
    () => {
      const numericMatch = factPart.match(/\b(\d+(\.\d+)?)\b/);
      if (!numericMatch) return null;
      
      const originalNumber = parseFloat(numericMatch[0]);
      let newNumber;
      
      // Generate a plausibly wrong number (not just slightly off)
      if (originalNumber >= 100) {
        // For large numbers, change by a significant percentage
        newNumber = originalNumber * (Math.random() < 0.5 ? 
          (0.5 + Math.random() * 0.3) : // 50-80% of original
          (1.2 + Math.random() * 0.5)); // 120-170% of original
      } else if (originalNumber >= 10) {
        // For medium numbers, add or subtract a significant amount
        newNumber = originalNumber + (Math.random() < 0.5 ? 
          -(3 + Math.floor(originalNumber * 0.3)) : // Subtract 3 plus up to 30%
          (3 + Math.floor(originalNumber * 0.3))); // Add 3 plus up to 30%
      } else {
        // For small numbers, change more dramatically
        newNumber = originalNumber + (Math.random() < 0.5 ? 
          -(1 + Math.floor(originalNumber)) : // Subtract at least 1
          (1 + Math.floor(originalNumber))); // Add at least 1
      }
      
      // Make sure the number is positive if the original was
      newNumber = Math.max(0, newNumber);
      
      // Round to same decimal places as original
      const decimalPlaces = numericMatch[0].includes('.') ? 
        numericMatch[0].split('.')[1].length : 0;
      newNumber = Number(newNumber.toFixed(decimalPlaces));
      
      // Replace the number in the text
      const altered = factPart.replace(
        new RegExp(`\\b${numericMatch[0]}\\b`), 
        newNumber.toString()
      );
      
      // Check if this phrase has already been used
      const key = altered.toLowerCase().trim();
      if (usedPhrases.has(key)) return null;
      usedPhrases.add(key);
      
      return altered;
    },
    
    // Type 5: Create a professional sounding alternative with qualifier changes
    () => {
      // Look for qualifiers that can be modified
      const qualifierPatterns = [
        { pattern: /\balways\b/gi, replacements: ['sometimes', 'rarely', 'never', 'occasionally'] },
        { pattern: /\bnever\b/gi, replacements: ['always', 'sometimes', 'usually', 'often'] },
        { pattern: /\bmost\b/gi, replacements: ['some', 'few', 'all', 'no'] },
        { pattern: /\ball\b/gi, replacements: ['most', 'some', 'few', 'no'] },
        { pattern: /\bmany\b/gi, replacements: ['few', 'several', 'no', 'countless'] },
        { pattern: /\bfew\b/gi, replacements: ['many', 'most', 'all', 'numerous'] },
        { pattern: /\bsignificantly\b/gi, replacements: ['slightly', 'marginally', 'negligibly', 'dramatically'] },
        { pattern: /\bprimarily\b/gi, replacements: ['rarely', 'secondarily', 'partially', 'exclusively'] },
        { pattern: /\btypically\b/gi, replacements: ['rarely', 'unusually', 'never', 'always'] }
      ];
      
      for (const {pattern, replacements} of qualifierPatterns) {
        if (pattern.test(factPart)) {
          // Reset pattern's lastIndex to ensure we match from the beginning
          pattern.lastIndex = 0;
          
          // Create replacement with a randomly selected alternative qualifier
          const replacement = replacements[Math.floor(Math.random() * replacements.length)];
          const altered = factPart.replace(pattern, replacement);
          
          // Check if this phrase has already been used
          const key = altered.toLowerCase().trim();
          if (usedPhrases.has(key)) continue;
          usedPhrases.add(key);
          
          return altered;
        }
      }
      
      return null;
    },
    
    // Type 6: Create a professional distractor by adding a completely fabricated but academic-sounding detail
    () => {
      // Get the core subject to craft a distractor around
      const subjectWords = subject.split(/\s+/).filter(w => w.length > 3);
      if (subjectWords.length === 0) return null;
      
      const mainSubject = subjectWords[0];
      
      // Templates for academic-sounding but incorrect statements
      const templates = [
        `${mainSubject} is primarily effective in controlled laboratory environments, not in practical applications.`,
        `Recent research has challenged conventional understanding of ${mainSubject}, suggesting limited efficacy in real-world scenarios.`,
        `${mainSubject} demonstrates a non-linear relationship with performance variables, contrary to traditional models.`,
        `The theoretical framework for ${mainSubject} was fundamentally revised in recent literature.`,
        `${mainSubject} exhibits significant performance variation across different demographic groups.`,
        `Statistical analysis has revealed that ${mainSubject} correlates with outcomes only under specific conditions.`,
        `The methodology commonly used to study ${mainSubject} has been critically reassessed for validity concerns.`,
        `Meta-analyses indicate that ${mainSubject} effects are moderated by contextual factors previously overlooked.`
      ];
      
      const distractor = templates[Math.floor(Math.random() * templates.length)];
      
      // Check if this phrase has already been used
      if (usedPhrases.has(distractor.toLowerCase())) return null;
      usedPhrases.add(distractor.toLowerCase());
      
      return distractor;
    }
  ];
  
  // Try all approaches until we have enough distractors
  let attemptsPerApproach = 3;
  
  while (distractors.length < count && attemptsPerApproach > 0) {
    for (const approach of approaches) {
      if (distractors.length >= count) break;
      
      const distractor = approach();
      if (distractor && 
          !distractors.includes(distractor) && 
          calculateSimilarity(distractor.toLowerCase(), factPart.toLowerCase()) < 0.7) {
        
        // Format and add the distractor
        distractors.push(formatOptionText(distractor));
        
        // If we've found enough distractors, stop
        if (distractors.length >= count) break;
      }
    }
    
    attemptsPerApproach--;
  }
  
  // If we still don't have enough distractors, create generic ones
  while (distractors.length < count) {
    const genericDistractors = [
      `This represents a common misconception about ${subject}.`,
      `This is an outdated interpretation that has since been revised in the literature.`,
      `This is not supported by empirical evidence related to ${subject}.`,
      `This confuses ${subject} with another related concept.`,
      `This is only applicable in specific contexts, not as a general principle.`,
      `This overstates the relationship between key variables.`,
      `This reflects a theoretical perspective that lacks practical validation.`,
      `This statement contains a logical fallacy regarding causation.`
    ];
    
    // Find a generic distractor that we haven't used yet
    for (const generic of genericDistractors) {
      if (!distractors.includes(generic)) {
        distractors.push(generic);
        break;
      }
    }
    
    // If all generics are used, create a numbered alternative
    if (distractors.length < count) {
      distractors.push(`Alternative explanation ${distractors.length + 1}: The relationship with ${subject} is more complex than commonly described.`);
    }
  }
  
  return distractors;
}

/**
 * Calculates the similarity between two strings (simple version)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  let matchCount = 0;
  
  for (const word of words1) {
    if (words2.includes(word)) {
      matchCount++;
    }
  }
  
  return matchCount / Math.max(words1.length, words2.length);
}

/**
 * Returns an antonym or alternative for a word
 */
function getAntonymOrAlternative(word: string): string {
  // Simple antonym pairs
  const antonyms: Record<string, string> = {
    good: 'bad', bad: 'good',
    high: 'low', low: 'high',
    large: 'small', small: 'large',
    positive: 'negative', negative: 'positive',
    true: 'false', false: 'true',
    correct: 'incorrect', incorrect: 'correct',
    increase: 'decrease', decrease: 'increase',
    major: 'minor', minor: 'major',
    important: 'unimportant', unimportant: 'important',
    strong: 'weak', weak: 'strong',
    modern: 'ancient', ancient: 'modern',
    hot: 'cold', cold: 'hot',
    easy: 'difficult', difficult: 'easy',
    early: 'late', late: 'early',
    fast: 'slow', slow: 'fast',
    many: 'few', few: 'many',
    rarely: 'frequently', frequently: 'rarely',
    always: 'never', never: 'always',
    all: 'none', none: 'all',
    external: 'internal', internal: 'external',
    complex: 'simple', simple: 'complex',
    short: 'long', long: 'short',
    enable: 'disable', disable: 'enable',
    required: 'optional', optional: 'required',
    include: 'exclude', exclude: 'include',
    significant: 'insignificant', insignificant: 'significant',
    similar: 'different', different: 'similar',
  };
  
  // Check for antonym
  const lowerWord = word.toLowerCase();
  
  if (antonyms[lowerWord]) {
    return antonyms[lowerWord];
  }
  
  // If no antonym, modify the word slightly
  if (lowerWord.startsWith('un')) {
    return lowerWord.substring(2);
  } else if (lowerWord.startsWith('in') && lowerWord.length > 3) {
    return lowerWord.substring(2);
  } else if (lowerWord.startsWith('dis')) {
    return lowerWord.substring(3);
  } else if (lowerWord.endsWith('ing')) {
    return `not ${lowerWord}`;
  } else if (lowerWord.length > 5) {
    // For longer words, add a prefix
    return `non-${lowerWord}`;
  }
  
  // Default: just negate it
  return `not ${lowerWord}`;
}

/**
 * Shuffles an array (Fisher-Yates algorithm)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

// Helper function to create comparison questions
function createComparisonQuestions(paragraphs: string[], questions: QuizQuestion[]) {
  // Look for comparison patterns
  const comparisonPatterns = [
    /compared to|in contrast|on the other hand|versus|vs\.|whereas|while/i,
    /difference between ([A-Za-z\s]+) and ([A-Za-z\s]+)/i,
    /([A-Za-z\s]+) differs from ([A-Za-z\s]+)/i
  ];
  
  paragraphs.forEach(paragraph => {
    for (const pattern of comparisonPatterns) {
      // Skip if we have enough questions
      if (questions.length >= 12) break;
      
      const matches = paragraph.match(pattern);
      if (matches) {
        // We found a comparison
        let questionText = "What is the main difference described in this text?";
        let comparedItems: string[] = [];
        
        if (matches.length >= 3) {
          comparedItems = [matches[1].trim(), matches[2].trim()];
          questionText = `What is the difference between ${comparedItems[0]} and ${comparedItems[1]}?`;
        }
        
        // The correct answer is the paragraph containing the comparison
        const correctAnswer = Math.floor(Math.random() * 4);
        const options = Array(4).fill("");
        
        // Use the complete paragraph as the correct answer
        options[correctAnswer] = paragraph;
        
        // Generate high-quality distractors
        const distractors = generateComparisonDistractors(comparedItems, paragraph, paragraphs);
        
        // Fill in the distractors
        let distractorIndex = 0;
        for (let i = 0; i < 4; i++) {
          if (i !== correctAnswer && distractorIndex < distractors.length) {
            options[i] = distractors[distractorIndex++];
          }
        }
        
        // If we still need more options, create some generic ones
        for (let i = 0; i < 4; i++) {
          if (!options[i]) {
            if (comparedItems.length >= 2) {
              options[i] = `There is no significant difference between ${comparedItems[0]} and ${comparedItems[1]}.`;
            } else {
              options[i] = "The text does not discuss any comparisons between concepts.";
            }
          }
        }
        
        questions.push({
          id: questions.length + 1,
          question: questionText,
          options: options,
          answer: correctAnswer,
          type: "single",
          difficulty: difficulty
        });
      }
    }
  });
}

// Function to generate high-quality distractors for comparison questions
function generateComparisonDistractors(comparedItems: string[], correctParagraph: string, paragraphs: string[]): string[] {
  const distractors: string[] = [];
  
  // Strategy 1: Find other comparison paragraphs
  const allText = paragraphs.join(' ');
  const sentences = allText.split(/\.\s+/).filter(s => s.length > 30 && s.length < 200);
  
  // Look for other comparison patterns
  const comparisonPatterns = [
    /compared to|in contrast|on the other hand|versus|vs\.|whereas|while/i,
    /difference between ([A-Za-z\s]+) and ([A-Za-z\s]+)/i,
    /([A-Za-z\s]+) differs from ([A-Za-z\s]+)/i
  ];
  
  for (const pattern of comparisonPatterns) {
    if (distractors.length >= 3) break;
    
    for (const sentence of sentences) {
      if (distractors.length >= 3) break;
      
      const matches = sentence.match(pattern);
      if (matches && sentence !== correctParagraph) {
        // Clean up the sentence to make it a complete statement
        let cleanSentence = sentence;
        if (!cleanSentence.endsWith('.')) {
          cleanSentence += '.';
        }
        distractors.push(cleanSentence);
      }
    }
  }
  
  // Strategy 2: Create logical but incorrect statements
  if (distractors.length < 3) {
    // Create logical but incorrect statements based on the compared items
    if (comparedItems.length >= 2) {
      const logicalDistractors = [
        `There is no significant difference between ${comparedItems[0]} and ${comparedItems[1]}.`,
        `${comparedItems[0]} and ${comparedItems[1]} are essentially the same concept.`,
        `The document does not clearly explain the differences between ${comparedItems[0]} and ${comparedItems[1]}.`,
        `${comparedItems[0]} and ${comparedItems[1]} are not directly compared in this document.`
      ];
      
      // Add these logical distractors
      for (let i = 0; i < Math.min(3 - distractors.length, logicalDistractors.length); i++) {
        distractors.push(logicalDistractors[i]);
      }
    } else {
      const logicalDistractors = [
        "The text does not discuss any comparisons between concepts.",
        "The document focuses on definitions rather than comparisons.",
        "No significant differences are described in this document.",
        "The text presents information sequentially rather than comparatively."
      ];
      
      // Add these logical distractors
      for (let i = 0; i < Math.min(3 - distractors.length, logicalDistractors.length); i++) {
        distractors.push(logicalDistractors[i]);
      }
    }
  }
  
  return distractors;
}

/**
 * Ensures that all options are unique and returns exactly 4 options
 * @param options Array of option texts
 * @param context The context (e.g., subject) to use for generating alternatives
 * @returns Array of exactly 4 unique options
 */
function ensureUniqueOptions(options: string[], context: string = ''): string[] {
  // First format all options
  let formattedOptions = options.map(opt => formatOptionText(opt));
  
  // Track which options we've seen by their core content (lowercase, trimmed)
  const seenContent = new Map<string, boolean>();
  const seenPhrases = new Set<string>();
  const result: string[] = [];
  
  // Enhanced alternative templates for more professional and academically appropriate distractors
  const alternativeTemplates = [
    `${context} applies only in specific contexts, not as a general principle.`,
    `${context} is related to other systems, but not directly applicable here.`,
    `This is a common misconception about ${context} that has been disproven.`,
    `${context} was historically viewed this way, but modern understanding differs.`,
    `This applies to a related concept, but not to ${context} specifically.`,
    `This represents a theoretical aspect of ${context} that hasn't been validated in practice.`,
    `This contradicts the established principles of ${context}.`,
    `This contains partial information about ${context} but omits critical elements.`,
    `${context} has been shown to have the opposite effect in controlled studies.`,
    `This confuses ${context} with another related but distinct concept.`,
    `Research indicates a more nuanced relationship with ${context} than this suggests.`,
    `While popular in non-academic contexts, this view of ${context} lacks empirical support.`,
    `The relationship with ${context} is correlational rather than causal as suggested.`,
    `This represents an outdated paradigm regarding ${context} that has since been revised.`,
    `This oversimplifies the complex mechanisms underlying ${context}.`,
    `The current scientific consensus contradicts this interpretation of ${context}.`,
    `This is based on an incomplete understanding of how ${context} functions.`,
    `This statement conflates ${context} with its effects rather than its causes.`,
    `This overgeneralizes findings about ${context} beyond their applicable domain.`,
    `This reverses the actual relationship between cause and effect regarding ${context}.`
  ];
  
  // Process each option and guarantee uniqueness
  for (let i = 0; i < formattedOptions.length && result.length < 4; i++) {
    const option = formattedOptions[i];
    if (!option || option.trim().length < 10) continue; // Skip empty or very short options
    
    const lowerOption = option.toLowerCase().trim();
    
    // Extract key phrases (3+ word phrases) to detect semantic similarity
    const words = lowerOption.split(/\s+/);
    const keyPhrases = [];
    for (let j = 0; j < words.length - 2; j++) {
      keyPhrases.push(words.slice(j, j + 3).join(' '));
    }
    
    // Check if this option is too similar to one we've seen
    let isTooSimilar = false;
    
    // Check for exact match or high overlap in key phrases
    if (seenContent.has(lowerOption)) {
      isTooSimilar = true;
    } else {
      // Check for phrase overlap
      for (const phrase of keyPhrases) {
        if (phrase.length > 10 && seenPhrases.has(phrase)) {
          isTooSimilar = true;
          break;
        }
      }
    }
    
    // If too similar or too short, replace it
    if (isTooSimilar || option.length < 15) {
      // If this is the correct answer (first option), we must keep it
      // but ensure it's distinct from any options we've already added
      if (i === 0 && result.length > 0) {
        // Keep the original content but make it clearly distinct
        const cleanOption = option.replace(/^The /i, '').replace(/\.$/, '');
        formattedOptions[i] = `The accurate definition of ${context} is: ${cleanOption}.`;
      } else {
        // For distractors, replace with a sophisticated alternative
        const altIndex = Math.floor(Math.random() * alternativeTemplates.length);
        formattedOptions[i] = alternativeTemplates[altIndex];
        
        // If we've used this template before, make it unique by adding a qualifier
        if (seenContent.has(formattedOptions[i].toLowerCase().trim())) {
          const qualifiers = [
            "Research shows",
            "Studies indicate",
            "Evidence suggests",
            "Experts maintain",
            "Analysis reveals",
            "Most specialists agree",
            "Current literature confirms",
            "Peer-reviewed studies demonstrate",
            "Contemporary research indicates",
            "Academic consensus suggests"
          ];
          const qualifier = qualifiers[Math.floor(Math.random() * qualifiers.length)];
          formattedOptions[i] = `${qualifier} that ${formattedOptions[i].charAt(0).toLowerCase()}${formattedOptions[i].slice(1)}`;
        }
      }
    }
    
    // Before adding to result, ensure this option is properly formatted
    let finalOption = formattedOptions[i];
    
    // Don't add if already exactly present
    if (result.some(existingOpt => existingOpt.toLowerCase() === finalOption.toLowerCase())) {
      continue;
    }
    
    // Ensure option ends with a period
    if (!finalOption.endsWith('.') && !finalOption.endsWith('?') && !finalOption.endsWith('!')) {
      finalOption += '.';
    }
    
    // Ensure option starts with a capital letter
    if (finalOption.length > 0 && finalOption[0].toLowerCase() === finalOption[0]) {
      finalOption = finalOption.charAt(0).toUpperCase() + finalOption.slice(1);
    }
    
    // Add to our result and mark as seen
    result.push(finalOption);
    seenContent.set(finalOption.toLowerCase().trim(), true);
    
    // Mark key phrases as seen
    for (const phrase of keyPhrases) {
      if (phrase.length > 10) {
        seenPhrases.add(phrase);
      }
    }
  }
  
  // If we have fewer than 4 options, add more sophisticated ones
  while (result.length < 4) {
    // Generate a new option that isn't too similar to existing ones
    const altIndex = Math.floor(Math.random() * alternativeTemplates.length);
    let newOption = alternativeTemplates[altIndex];
    
    // Ensure uniqueness
    if (seenContent.has(newOption.toLowerCase().trim())) {
      const contextWords = context.split(/\s+/);
      const subjectWord = contextWords[contextWords.length - 1]; // Get last word as fallback
      
      const alternativeFormats = [
        `Research in ${context} has not validated this approach.`,
        `This applies to ${subjectWord}-adjacent fields but not ${context} itself.`,
        `This is based on outdated information about ${context}.`,
        `This confuses correlation with causation regarding ${context}.`,
        `The empirical evidence does not support this claim about ${context}.`,
        `This greatly oversimplifies the complexity associated with ${context}.`,
        `This represents a theoretical rather than practical understanding of ${context}.`,
        `This conflates different aspects of ${context} that should be considered separately.`
      ];
      
      newOption = alternativeFormats[Math.floor(Math.random() * alternativeFormats.length)];
    }
    
    // Ensure option ends with a period
    if (!newOption.endsWith('.') && !newOption.endsWith('?') && !newOption.endsWith('!')) {
      newOption += '.';
    }
    
    // Ensure option starts with a capital letter
    if (newOption.length > 0 && newOption[0].toLowerCase() === newOption[0]) {
      newOption = newOption.charAt(0).toUpperCase() + newOption.slice(1);
    }
    
    // Add to results if not already present
    if (!result.some(existingOpt => existingOpt.toLowerCase() === newOption.toLowerCase())) {
      result.push(newOption);
      seenContent.set(newOption.toLowerCase().trim(), true);
    }
  }
  
  // If we have more than 4 options, keep only the first 4
  if (result.length > 4) {
    return result.slice(0, 4);
  }
  
  return result;
}

/**
 * Creates multiple-select questions (MSQ) from the extracted content
 * Enhanced to ensure proper question type identification and unique options
 */
function createMultipleSelectQuestions(chunks: string[], keyFacts: string[], difficulty: DifficultyLevel): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const msqLimit = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : 5;
  
  console.log("Generating multiple-select questions...");
  
  // Look for sentences with lists or enumerations
  for (const chunk of chunks) {
    if (questions.length >= msqLimit) break;
    
    // Split into sentences
    const sentences = chunk.split(/\.(?:\s+|$)/).filter(s => s.trim().length > 40);
    
    for (const sentence of sentences) {
      if (questions.length >= msqLimit) break;
      
      // Look for sentences that have list indicators or numerations
      if (
        sentence.includes(",") && 
        (
          sentence.match(/\b(include|includes|including|such as|like|namely|i\.e\.|e\.g\.)\b/i) ||
          sentence.match(/\b(following|several|many|multiple|various|different)\b/i) ||
          sentence.match(/\b(first|second|third|fourth|finally)\b/i) ||
          sentence.match(/\b(\d+)\.\s+\w+/i)
        )
      ) {
        // Try to identify the subject and the list of items
        const listPatterns = [
          // Pattern: Subject includes/has items such as A, B, C, and D
          /^(.+?)\b(include|includes|including|such as|like|has|have|contains|comprise|comprises|consisting of)\b(.+)$/i,
          // Pattern: The following/several items are part of Subject: A, B, C, and D
          /^(The\s+following|Several|Various|Many|Multiple|Different)\s+(.+?)\s+(?:are|include|comprise)\s+(.+)$/i,
        ];
        
        let subject = '';
        let itemText = '';
        
        // Try to match any list pattern
        for (const pattern of listPatterns) {
          const match = sentence.match(pattern);
          if (match) {
            subject = match[1].trim();
            itemText = match[3].trim();
            break;
          }
        }
        
        // If no specific pattern matched, use a general approach
        if (!subject && !itemText) {
          // Look for common list indicators
          const parts = sentence.split(/\b(such as|including|like|namely|i\.e\.|e\.g\.)\b/i);
          if (parts.length > 1) {
            subject = parts[0].trim();
            itemText = parts[2].trim();
          }
        }
        
        // If we found a subject and items, create a question
        if (subject && itemText) {
          // Extract the list items
          let items = itemText.split(/\s*,\s*|\s+and\s+|\s*;\s*|\s*\|\s*/).filter(item => 
            item.trim().length > 0 && 
            !item.match(/^(and|or|the|a|an)$/i)
          );
          
          // Filter out very short or duplicate items
          items = items.filter((item, index, self) => 
            item.length > 3 && 
            self.indexOf(item) === index
          );
          
          // If we have enough items, create a multiple-select question
          if (items.length >= 2) {
            // Create question text based on difficulty, but make it clearer
            let questionText = '';
            switch (difficulty) {
              case "easy":
                questionText = `Which of these are ${subject}? (Select all that apply)`;
                break;
              case "medium":
                questionText = `Which of these are components of ${subject}? (Select all that apply)`;
                break;
              case "hard":
                questionText = `Which elements make up ${subject}? (Select all that apply)`;
                break;
            }
            
            // Format the question to be more clear
            questionText = formatQuestionText(questionText);
            
            // Determine how many correct answers to include (1-3 correct answers out of 4 total)
            const correctCount = Math.min(Math.max(1, Math.min(3, Math.floor(items.length / 2))), 3);
            
            // Select random items for correct answers
            shuffleArray(items);
            const correctItems = items.slice(0, correctCount);
            
            // Generate incorrect options
            const incorrectOptions = generateIncorrectMSQOptions(subject, correctItems, keyFacts, chunks);
            
            // We need exactly 4 total options (some correct, some incorrect)
            // Make sure we have enough incorrect options
            while (incorrectOptions.length < (4 - correctCount)) {
              const newIncorrect = `Another unrelated aspect of ${subject}.`;
              if (!incorrectOptions.includes(newIncorrect)) {
                incorrectOptions.push(newIncorrect);
              } else {
                incorrectOptions.push(`Alternative approach to ${subject} #${incorrectOptions.length + 1}.`);
              }
            }
            
            // Create final option list with both correct and incorrect options (exactly 4 total)
            let allOptions = [
              ...correctItems, 
              ...incorrectOptions.slice(0, 4 - correctItems.length)
            ];
            
            // Format and ensure options are unique
            allOptions = ensureUniqueOptions(
              allOptions.map(option => formatOptionText(option)),
              subject
            );
            
            // Shuffle options
            const shuffledOptions = shuffleArray([...allOptions]);
            
            // Find indices of correct answers in the shuffled options
            const correctIndices: number[] = [];
            const lowerCorrectItems = correctItems.map(item => item.toLowerCase());
            
            for (let i = 0; i < shuffledOptions.length; i++) {
              const option = shuffledOptions[i].toLowerCase();
              
              // Check each correct item for substantial overlap with this option
              for (const correctItem of lowerCorrectItems) {
                if (option.includes(correctItem) || 
                    calculateSimilarity(option, correctItem) > 0.7) {
                  correctIndices.push(i);
                  break;
                }
              }
            }
            
            // Only add the question if we found the correct answers in the shuffled options
            if (correctIndices.length > 0) {
              questions.push({
                id: 0, // Will be assigned later
                question: questionText,
                options: shuffledOptions,
                answer: correctIndices,
                type: "multiple", // Explicitly mark as multiple-select
                difficulty: difficulty
              });
            }
          }
        }
      }
    }
  }
  
  // If we couldn't create enough questions, create some generic ones
  if (questions.length < msqLimit && keyFacts.length >= 4) {
    const remainingCount = msqLimit - questions.length;
    const genericQuestions = createGenericMultipleSelectQuestions(keyFacts, difficulty, remainingCount);
    questions.push(...genericQuestions);
  }
  
  return questions;
}

/**
 * Creates generic multiple-select questions when specific list patterns aren't found
 */
function createGenericMultipleSelectQuestions(facts: string[], difficulty: DifficultyLevel, count: number): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const shuffledFacts = shuffleArray([...facts]);
  
  // Group facts by potential subjects
  const subjectGroups = new Map<string, string[]>();
  
  for (const fact of shuffledFacts) {
    const words = fact.split(/\s+/);
    if (words.length < 3) continue;
    
    // Use the first 1-2 words as potential subject
    const subject = words.slice(0, Math.min(2, words.length - 1)).join(' ').toLowerCase();
    
    if (!subjectGroups.has(subject)) {
      subjectGroups.set(subject, []);
    }
    subjectGroups.get(subject)?.push(fact);
  }
  
  // Find subjects with multiple facts
  const potentialSubjects = Array.from(subjectGroups.entries())
    .filter(([_, facts]) => facts.length >= 2)
    .map(([subject, _]) => subject);
  
  // Create questions for subjects with enough facts
  for (let i = 0; i < Math.min(count, potentialSubjects.length); i++) {
    const subject = potentialSubjects[i];
    const relatedFacts = subjectGroups.get(subject) || [];
    
    if (relatedFacts.length < 2) continue;
    
    // Create question text
    const questionText = formatQuestionText(`Which statements about ${subject} are correct? (Select all that apply)`);
    
    // Use some facts as correct answers (1-3)
    const correctCount = Math.min(Math.max(1, Math.floor(relatedFacts.length / 2)), 3);
    const correctFacts = relatedFacts.slice(0, correctCount).map(formatOptionText);
    
    // Generate incorrect statements as distractors
    const incorrectOptions: string[] = [];
    const otherFacts = facts.filter(f => !relatedFacts.includes(f));
    
    // Create false statements by mixing with other facts
    for (let j = 0; j < (4 - correctCount); j++) {
      if (otherFacts.length > j) {
        const otherFact = otherFacts[j];
        incorrectOptions.push(formatOptionText(createFalseStatement(otherFact, facts, '')));
      } else {
        incorrectOptions.push(formatOptionText(`${subject} is not related to the main topics covered.`));
      }
    }
    
    // Combine all options and shuffle
    const allOptions = ensureUniqueOptions([...correctFacts, ...incorrectOptions], subject);
    const shuffledOptions = shuffleArray([...allOptions]);
    
    // Find indices of correct answers
    const correctIndices: number[] = [];
    for (let j = 0; j < shuffledOptions.length; j++) {
      for (const correctFact of correctFacts) {
        if (calculateSimilarity(shuffledOptions[j], correctFact) > 0.7) {
          correctIndices.push(j);
          break;
        }
      }
    }
    
    // Add the question
    if (correctIndices.length > 0) {
      questions.push({
        id: 0, // Will be assigned later
        question: questionText,
        options: shuffledOptions,
        answer: correctIndices,
        type: "multiple",
        difficulty: difficulty
      });
    }
  }
  
  return questions;
}

// Generate plausible but incorrect options for multiple-select questions
function generateIncorrectMSQOptions(subject: string, correctItems: string[], keyFacts: string[], chunks: string[]): string[] {
  const incorrectOptions: string[] = [];
  
  // Try to generate at least 3-4 incorrect options
  
  // 1. Look for related terms in the text
  const relatedTerms = new Set<string>();
  const pattern = new RegExp(`\\b(\\w+(?:\\s+\\w+){0,2})\\b(?=.*\\b${subject}\\b)`, 'gi');
  
  // Search for related terms in all chunks
  for (const chunk of chunks) {
    let match;
    while ((match = pattern.exec(chunk)) !== null) {
      const term = match[1].trim();
      if (
        term.length > 3 && 
        !correctItems.includes(term) && 
        !term.match(/^(the|a|an|this|that|these|those|is|are|and|or|but|if|then)$/i)
      ) {
        relatedTerms.add(term);
      }
    }
  }
  
  // 2. Add some related terms to the incorrect options
  for (const term of relatedTerms) {
    if (incorrectOptions.length >= 4) break;
    incorrectOptions.push(term);
  }
  
  // 3. If we don't have enough, create some plausible distractors
  if (incorrectOptions.length < 3) {
    // Extract words from correct items to create plausible but incorrect combinations
    const words = correctItems.flatMap(item => item.split(/\s+/));
    const uniqueWords = [...new Set(words)].filter(word => word.length > 3);
    
    if (uniqueWords.length >= 2) {
      // Create synthetic options by combining words in new ways
      for (let i = 0; i < uniqueWords.length - 1 && incorrectOptions.length < 4; i++) {
        for (let j = i + 1; j < uniqueWords.length && incorrectOptions.length < 4; j++) {
          const syntheticOption = `${uniqueWords[i]} ${uniqueWords[j]}`;
          if (
            !correctItems.includes(syntheticOption) && 
            !incorrectOptions.includes(syntheticOption)
          ) {
            incorrectOptions.push(syntheticOption);
          }
        }
      }
    }
  }
  
  // 4. If we still don't have enough, add some generic distractors
  const genericDistractors = [
    `Unrelated aspect of ${subject}`,
    `External factor affecting ${subject}`,
    `Alternative version of ${subject}`,
    `Theoretical component not mentioned in the text`
  ];
  
  while (incorrectOptions.length < 3) {
    const index = incorrectOptions.length % genericDistractors.length;
    incorrectOptions.push(genericDistractors[index]);
  }
  
  return incorrectOptions;
}

/**
 * Format questions to be more natural and clear
 * @param question The question text to format
 * @returns Formatted question text
 */
function formatQuestionText(question: string): string {
  // Remove "According to the document" and similar phrases
  let formatted = question
    .replace(/^according to the (document|text|passage|content),?\s*/i, '')
    .replace(/^based on the (document|text|passage|content),?\s*/i, '')
    .replace(/\bin the (document|text|passage|content)\b/i, '')
    .replace(/\bas (stated|mentioned|described|noted|indicated) in the (document|text|passage|content)\b/i, '');
  
  // Fix questions that start with "Which of the following..."
  if (formatted.match(/^which of the following/i)) {
    formatted = formatted
      // Remove awkward phrasing
      .replace(/are associated with/i, 'are characteristics of')
      .replace(/are correctly identified as/i, 'are')
      .replace(/elements are/i, 'are')
      .replace(/statements is/i, 'is')
      .replace(/best represents/i, 'is')
      .replace(/is accurately described as/i, 'is')
      
      // Fix common awkward question structures
      .replace(/which of the following (is|are) (.*?) of (.*?)\?/i, 'What $2 of $3?')
      .replace(/which of the following best describes (.*?)\?/i, 'What is $1?')
      .replace(/which of the following best defines (.*?)\?/i, 'What is the definition of $1?')
      .replace(/which of the following best characterizes (.*?)\?/i, 'What characterizes $1?');
      
    // If we still have "which of the following", make it more direct
    if (formatted.match(/^which of the following/i)) {
      formatted = formatted
        .replace(/^which of the following (is|are) (.*?)\?/i, 'What $2?');
    }
  }
  
  // Fix questions that are about statements
  formatted = formatted
    .replace(/which statement about (.*?) is (correct|true|accurate|valid)/i, 'What is true about $1?')
    .replace(/which of the following statements about (.*?) is (correct|true|accurate|valid)/i, 'What is true about $1?')
    .replace(/which of the statements (below|above) (is|are) (correct|true|accurate|valid)/i, 'Which statement is true?')
    .replace(/which (is|are) (not|false) (correct|true|accurate|valid)/i, 'Which is incorrect?');
  
  // Fix other common awkward phrasings
  formatted = formatted
    .replace(/\bwith a\b/i, 'in a')
    .replace(/\b(typically|generally|commonly|usually|normally|primarily|essentially|frequently|often|sometimes|occasionally),\s*/i, '')
    .replace(/\bplease (identify|select|choose|pick)\b/i, 'What is')
    .replace(/\bcan be best described as\b/i, 'is')
    .replace(/\bis best characterized as\b/i, 'is');
  
  // Fix awkward questions about definition/meaning/purpose
  formatted = formatted
    .replace(/what (is|are) the (definition|meaning|purpose|goal|objective|aim|function|role) of (.*?)\?/i, 'What is $3?')
    .replace(/what does (.*?) (mean|refer to|indicate|signify|represent)\?/i, 'What is $1?');
    
  // Make comparative questions clearer
  formatted = formatted
    .replace(/how does (.*?) (differ|compare) (from|to|with) (.*?)\?/i, 'What differentiates $1 from $4?')
    .replace(/what is the (main|primary|key|significant|major) difference between (.*?) and (.*?)\?/i, 'What differentiates $2 from $3?');
  
  // Replace double spaces
  formatted = formatted.replace(/\s{2,}/g, ' ').trim();
  
  // Ensure the question ends with a question mark
  if (!formatted.endsWith('?')) {
    formatted += '?';
  }
  
  // Make sure the first letter is capitalized
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Format options to ensure clarity and readability
 * @param option The option text to format
 * @returns Formatted option text
 */
function formatOptionText(option: string): string {
  if (!option || option.trim().length === 0) return "Information not available";
  
  // Clean the option text
  let formatted = option.trim();
  
  // Remove awkward phrasings
  formatted = formatted
    .replace(/^according to the (document|text|passage|content),?\s*/i, '')
    .replace(/^based on the (document|text|passage|content),?\s*/i, '')
    .replace(/\bin the (document|text|passage|content)\b/i, '')
    .replace(/\bas (stated|mentioned|described|noted|indicated) in the (document|text|passage|content)\b/i, '')
    .replace(/\b(typically|generally|commonly|usually|normally|primarily|essentially|frequently|often|sometimes|occasionally),\s*/i, '')
    .replace(/^\s*(it|this|that|these|those|they)\s+(is|are|was|were)\s+/i, '')
    .replace(/^\s*(the|an|a)\s+/i, 'The ');
  
  // Convert to concise MCQ option format
  // First, identify if this is already a short option
  if (formatted.length <= 50 && formatted.split(/\s+/).length <= 10) {
    // Already concise, just clean it up
    formatted = formatted
      .replace(/\.$/, '') // Remove trailing period
      .replace(/\s{2,}/g, ' '); // Remove extra spaces
  } else {
    // Extract key information from longer text
    const sentences = formatted.split(/[.!?]+/);
    if (sentences.length > 1) {
      // Take the most informative sentence (usually the first one)
      const mainSentence = sentences[0].trim();
      
      // Extract subject and predicate
      const parts = mainSentence.split(/\s+/);
      
      if (parts.length <= 10) {
        // Use the whole sentence if it's already short enough
        formatted = mainSentence;
      } else {
        // Extract key components using different approaches
        let conciseOption = '';
        
        // Approach 1: Extract subject + verb + key object (first 6-8 words)
        conciseOption = parts.slice(0, Math.min(8, parts.length)).join(' ');
        
        // Approach 2: If there are numbers or specific data points, make sure they're included
        const hasNumbers = /\d+/.test(mainSentence);
        if (hasNumbers) {
          // Find the segment with numbers
          const numberSegment = sentences.find(s => /\d+/.test(s)) || mainSentence;
          // Extract a concise version that includes the numbers
          const numberMatch = numberSegment.match(/\b(\w+\s+){0,3}\d+(\.\d+)?(\s+\w+){0,3}/);
          if (numberMatch && numberMatch[0].length < conciseOption.length) {
            conciseOption = numberMatch[0];
          }
        }
        
        // Approach 3: Extract key terms in case the above approaches produce poor results
        const keyTerms = parts.filter(word => 
          word.length > 5 || 
          /^[A-Z][a-z]+$/.test(word) || // Proper nouns
          /\d+/.test(word)              // Numbers
        ).slice(0, 5).join(' ');
        
        if (keyTerms.length > 10 && keyTerms.length < conciseOption.length) {
          conciseOption = keyTerms;
        }
        
        formatted = conciseOption;
      }
    }
    
    // If we still have a long option, truncate but preserve meaning
    if (formatted.length > 50 || formatted.split(/\s+/).length > 10) {
      const words = formatted.split(/\s+/);
      formatted = words.slice(0, 8).join(' ');
      
      // Add ellipsis if truncated
      if (words.length > 8) {
        formatted += '...';
      }
    }
  }
  
  // Ensure first character is uppercase
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  
  // Don't add period for short phrases, only for sentences
  if (formatted.length > 15 && 
      !formatted.endsWith('.') && 
      !formatted.endsWith('?') && 
      !formatted.endsWith('!') &&
      !formatted.endsWith('"') &&
      !formatted.endsWith("'") &&
      !formatted.endsWith("...")) {
    formatted += '.';
  }
  
  // Make sure no HTML tags are included
  formatted = formatted.replace(/<[^>]*>/g, '');
  
  // Ensure reasonable length (not too short, not too long)
  if (formatted.length < 3) {
    formatted = `Not applicable`;
  }
  
  return formatted;
}

/**
 * Check if options are too similar and need differentiation
 * @param options Array of option texts
 * @returns true if options need differentiation
 */
function optionsNeedDifferentiation(options: string[]): boolean {
  const uniqueOptions = new Set(options.map(o => o.toLowerCase().trim()));
  return uniqueOptions.size < options.length || options.some(opt => opt.length < 4);
}

/**
 * Format options for exam-style questions with consistent styling
 */
function formatExamOption(option: string): string {
  return formatOptionText(option);
}

/**
 * Creates exam-style questions with professional formatting and difficulty levels
 */
function createExamQuestions(
  facts: string[],
  allText: string,
  count: number = 10,
  difficulty: DifficultyLevel = "medium"
): QuizQuestion[] {
  // Determine the number of questions based on difficulty
  let numQuestions = count;
  if (difficulty === "easy") {
    numQuestions = Math.min(count, 5);
  } else if (difficulty === "hard") {
    numQuestions = Math.min(count, 15);
  }

  // Ensure we have enough facts
  numQuestions = Math.min(numQuestions, facts.length);
  if (numQuestions === 0) return [];

  // Filter and prioritize facts based on quality and informativeness
  const rankedFacts = [...facts]
    .filter(fact => {
      // Filter out very short or low-quality facts
      if (fact.trim().length < 30) return false;
      
      // Check if fact contains meaningful information
      const hasVerb = /\b(is|are|was|were|has|have|can|could|will|would|do|does|did)\b/i.test(fact);
      const hasNoun = /\b([A-Z][a-z]+|[a-z]+(?:[-'][a-z]+)*)\b/g.test(fact);
      
      return hasVerb && hasNoun;
    })
    .sort((a, b) => {
      // Complex scoring system for fact quality
      const scoreA = scoreFactQuality(a);
      const scoreB = scoreFactQuality(b);
      return scoreB - scoreA || Math.random() - 0.5; // Random if scores equal
    });
  
  // If we don't have enough high-quality facts, use the original facts
  const selectedFacts = rankedFacts.length >= numQuestions 
    ? rankedFacts.slice(0, numQuestions)
    : shuffleArray([...facts])
        .filter(fact => fact.trim().length > 20)
        .slice(0, numQuestions);

  return selectedFacts.map((fact, index) => {
    // Extract a meaningful subject and action from the fact
    const subjectActionPair = extractSubjectAndAction(fact);
    const subject = subjectActionPair.subject;
    
    // Generate a question based on the subject, action, and difficulty
    const question = generateQuestionFromFact(subject, fact, difficulty, index);
    
    // The correct answer is the fact itself, formatted for consistency
    const correctAnswer = formatOptionText(fact);
    
    // Generate distractors using the dedicated function
    const distractors = generateExamDistractors(fact, facts, difficulty);
    
    // Ensure options are distinct and professionally phrased
    const allOptions = [correctAnswer, ...distractors];
    const distinctOptions = ensureUniqueOptions(allOptions.slice(0, 4), subject);
    
    // Combine correct answer with distractors and shuffle
    const shuffledOptions = shuffleArray([...distinctOptions]);
    
    // Implement a robust method to find the correct answer in shuffled options
    let correctIndex = findCorrectAnswerIndex(shuffledOptions, fact, correctAnswer);
    
    // If we couldn't find the correct answer by similarity, ensure it's included
    if (correctIndex < 0) {
      // Replace a random option with the correct answer
      const randomIndex = Math.floor(Math.random() * shuffledOptions.length);
      shuffledOptions[randomIndex] = correctAnswer;
      correctIndex = randomIndex;
    }

    return {
      id: index + 1,
      question,
      options: shuffledOptions.slice(0, 4), // Ensure we have at most 4 options
      answer: correctIndex,
      type: "single",
      difficulty: difficulty
    };
  });
}

/**
 * Scores a fact based on its quality and informativeness
 * Higher scores indicate more suitable facts for quiz questions
 */
function scoreFactQuality(fact: string): number {
  let score = 0;
  
  // Length-based scoring (prefer medium-length facts)
  if (fact.length >= 40 && fact.length <= 150) score += 3;
  else if (fact.length > 150 && fact.length <= 200) score += 2;
  else score += 1;
  
  // Content-based scoring
  if (/\b(because|therefore|thus|consequently|as a result)\b/i.test(fact)) score += 2; // Causal relationships
  if (/\b(defined as|refers to|means|is a|are a)\b/i.test(fact)) score += 2; // Definitions
  if (/\d+/.test(fact)) score += 1; // Contains numbers
  if (/\b(first|second|third|primary|mainly|most importantly)\b/i.test(fact)) score += 1; // Ordered information
  if (/\b(however|although|despite|while|whereas)\b/i.test(fact)) score += 2; // Contrasting information
  
  // Structure-based scoring
  const sentenceCount = (fact.match(/[.!?]+/g) || []).length;
  if (sentenceCount === 1) score += 2; // Single, complete sentence
  
  return score;
}

/**
 * Extracts subject and action from a fact
 */
function extractSubjectAndAction(fact: string): { subject: string; action: string } {
  // Look for subject-verb patterns
  const subjectVerbMatch = fact.match(/^((?:\w+\s+){1,4})(?:is|are|was|were|has|have|can|could|will|would|do|does|did)\b/i);
  
  if (subjectVerbMatch) {
    const subject = subjectVerbMatch[1].trim();
    // Extract the rest as the action
    const actionStart = fact.indexOf(subject) + subject.length;
    const action = fact.substring(actionStart).trim();
    return { subject, action };
  }
  
  // Fallback to simpler pattern
  const words = fact.split(/\s+/);
  const subject = words.slice(0, Math.min(4, Math.ceil(words.length / 3))).join(' ');
  const action = words.slice(Math.min(4, Math.ceil(words.length / 3))).join(' ');
  
  return { subject, action };
}

/**
 * Generates a question from a fact based on difficulty
 */
function generateQuestionFromFact(subject: string, fact: string, difficulty: DifficultyLevel, index: number): string {
  // Create different question formats based on difficulty and fact structure
  let questionTemplates: string[];
  
  if (difficulty === "easy") {
    questionTemplates = [
      `What is true about ${subject}?`,
      `Which statement correctly describes ${subject}?`,
      `What is a correct fact about ${subject}?`
    ];
  } else if (difficulty === "medium") {
    // Check if the fact contains specific patterns to create more targeted questions
    if (/\b(because|therefore|thus|consequently|as a result)\b/i.test(fact)) {
      questionTemplates = [
        `What is the relationship between ${subject} and its effects?`,
        `What causal relationship exists regarding ${subject}?`,
        `Which statement correctly explains the impact of ${subject}?`
      ];
    } else if (/\b(defined as|refers to|means|is a|are a)\b/i.test(fact)) {
      questionTemplates = [
        `Which definition of ${subject} is correct?`,
        `How is ${subject} best defined?`,
        `What is the meaning of ${subject}?`
      ];
    } else {
      questionTemplates = [
        `Which statement accurately represents ${subject}?`,
        `What is the correct information about ${subject}?`,
        `Which of the following accurately describes ${subject}?`
      ];
    }
  } else {
    // Hard difficulty - more specific and challenging questions
    questionTemplates = [
      `What is the most accurate characterization of ${subject}?`,
      `Which description of ${subject} is supported by evidence?`,
      `Among these statements about ${subject}, which one is factually correct?`,
      `What does current understanding of ${subject} indicate?`,
      `Which statement represents the most accurate analysis of ${subject}?`
    ];
  }
  
  // Select a template based on the index to ensure variety
  const template = questionTemplates[index % questionTemplates.length];
  
  return formatQuestionText(template);
}

/**
 * Find the index of the correct answer in the shuffled options using robust matching
 */
function findCorrectAnswerIndex(shuffledOptions: string[], originalFact: string, formattedCorrectAnswer: string): number {
  // Try multiple methods to find the correct answer

  // Method 1: Direct string comparison (normalized)
  for (let i = 0; i < shuffledOptions.length; i++) {
    if (shuffledOptions[i].toLowerCase().trim() === formattedCorrectAnswer.toLowerCase().trim()) {
      return i;
    }
  }
  
  // Method 2: Key phrase matching
  const keyPhrases = extractKeyPhrases(originalFact);
  if (keyPhrases.length > 0) {
    for (let i = 0; i < shuffledOptions.length; i++) {
      const option = shuffledOptions[i].toLowerCase();
      // Count how many key phrases from the original fact appear in this option
      const matchCount = keyPhrases.filter(phrase => option.includes(phrase.toLowerCase())).length;
      // If most key phrases match, this is likely the correct answer
      if (matchCount >= Math.ceil(keyPhrases.length * 0.7)) {
        return i;
      }
    }
  }
  
  // Method 3: Similarity calculation
  let highestSimilarity = 0;
  let mostSimilarIndex = -1;
  
  for (let i = 0; i < shuffledOptions.length; i++) {
    const similarity = calculateSimilarity(
      shuffledOptions[i].toLowerCase(), 
      formattedCorrectAnswer.toLowerCase()
    );
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      mostSimilarIndex = i;
    }
  }
  
  // Return the most similar if it's above threshold
  if (highestSimilarity > 0.7) {
    return mostSimilarIndex;
  }
  
  return -1; // Couldn't find a match
}

/**
 * Extract key phrases from a fact that represent its core meaning
 */
function extractKeyPhrases(fact: string): string[] {
  const phrases: string[] = [];
  
  // Extract noun phrases (simplistic approach)
  const nounPhraseRegex = /\b([A-Z][a-z]+(?:\s+[a-z]+){0,2}|[a-z]+(?:\s+[a-z]+){0,2})\b/g;
  const nounMatches = fact.match(nounPhraseRegex) || [];
  phrases.push(...nounMatches.filter(np => np.length > 5));
  
  // Extract key terms based on factual statements
  const verbPatterns = [
    /\b(is|are|was|were)\s+([a-z]+(?:\s+[a-z]+){0,3})\b/gi,
    /\b(has|have|had)\s+([a-z]+(?:\s+[a-z]+){0,3})\b/gi,
    /\b(can|could|will|would|should)\s+([a-z]+(?:\s+[a-z]+){0,3})\b/gi
  ];
  
  for (const pattern of verbPatterns) {
    const matches = [...fact.matchAll(pattern)];
    for (const match of matches) {
      if (match[2] && match[2].length > 3) {
        phrases.push(match[2]);
      }
    }
  }
  
  return [...new Set(phrases)]; // Return unique phrases
}

/**
 * Generates plausible incorrect options for exam-style questions
 * based on the correct answer and available facts
 */
function generateExamDistractors(
  correctAnswer: string,
  facts: string[],
  difficultyLevel: DifficultyLevel
): string[] {
  // Filter out facts that are too similar to the correct answer
  const filteredFacts = facts.filter(fact => {
    const similarity = calculateSimilarity(fact.toLowerCase(), correctAnswer.toLowerCase());
    return similarity < 0.7; // Not too similar
  });

  // Number of distractors to generate depends on difficulty
  let numDistractors = 5; // Generate more than needed to allow for filtering
  if (difficultyLevel === 'hard') numDistractors = 7;
  
  const distractors: string[] = [];
  
  // Approach 1: Use negation of the correct answer if possible
  if (correctAnswer.match(/\b(is|are|has|have|was|were|will|can|could|does|do|did)\b/i)) {
    const negatedAnswer = correctAnswer
      .replace(/\b(is|are)\b/i, match => match.toLowerCase() === 'is' ? 'is not' : 'are not')
      .replace(/\b(has|have)\b/i, match => match.toLowerCase() === 'has' ? 'does not have' : 'do not have')
      .replace(/\b(was|were)\b/i, match => match.toLowerCase() === 'was' ? 'was not' : 'were not')
      .replace(/\b(will|can|could)\b/i, match => match.toLowerCase() + ' not')
      .replace(/\b(does|do|did)\b/i, match => match.toLowerCase() + ' not');
    
    distractors.push(negatedAnswer);
  }
  
  // Approach 2: Modify key terms in the correct answer
  const keyTermRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[A-Za-z]+(?:[-'][A-Za-z]+)*)\b/g;
  const keyTerms = correctAnswer.match(keyTermRegex) || [];
  
  if (keyTerms.length > 0) {
    // Replace key terms with similar but incorrect terms
    for (let i = 0; i < Math.min(keyTerms.length, 2); i++) {
      const term = keyTerms[i];
      const altTerm = getAlternativeTerm(term);
      if (altTerm && altTerm !== term) {
        const modified = correctAnswer.replace(new RegExp(`\\b${term}\\b`, 'i'), altTerm);
        distractors.push(modified);
      }
    }
  }
  
  // Approach 3: Use other facts as distractors
  let factsToUse = shuffleArray([...filteredFacts]).slice(0, numDistractors - distractors.length);
  distractors.push(...factsToUse);
  
  // For hard difficulty, introduce subtle changes to make distractors harder to spot
  if (difficultyLevel === 'hard' && distractors.length < numDistractors) {
    const subtleDistractors = filteredFacts.map(fact => {
      // For hard questions, make subtle changes to facts
      const words = fact.split(' ');
      if (words.length > 5) {
        // Change one or two words in the middle
        const index = Math.floor(words.length / 2);
        words[index] = getAlternativeTerm(words[index]) || words[index];
        return words.join(' ');
      }
      return fact;
    });
    
    distractors.push(...subtleDistractors.slice(0, numDistractors - distractors.length));
  }
  
  // Ensure we return unique distractors
  return Array.from(new Set(distractors)).slice(0, numDistractors);
}

/**
 * Gets an alternative term for the given word to use in false statements
 * @param word The original word to find an alternative for
 * @returns An alternative term or the original if none found
 */
function getAlternativeTerm(word: string): string {
  // Dictionary of common terms and their alternatives
  const alternatives: Record<string, string[]> = {
    // General concepts
    "increase": ["decrease", "reduce", "decline"],
    "decrease": ["increase", "grow", "rise"],
    "important": ["unimportant", "insignificant", "trivial"],
    "significant": ["insignificant", "minimal", "negligible"],
    "high": ["low", "minimal", "reduced"],
    "low": ["high", "elevated", "increased"],
    "large": ["small", "tiny", "minimal"],
    "small": ["large", "substantial", "enormous"],
    "many": ["few", "hardly any", "a small number of"],
    "few": ["many", "numerous", "a large number of"],
    "always": ["never", "rarely", "seldom"],
    "never": ["always", "frequently", "commonly"],
    "positive": ["negative", "unfavorable", "adverse"],
    "negative": ["positive", "favorable", "beneficial"],
    "early": ["late", "delayed", "postponed"],
    "late": ["early", "prompt", "immediate"],
    "first": ["last", "final", "ultimate"],
    "last": ["first", "initial", "primary"],
    
    // Academic/scientific terms
    "analysis": ["synthesis", "overview", "summary"],
    "research": ["speculation", "conjecture", "hypothesis"],
    "experiment": ["observation", "survey", "review"],
    "theory": ["fact", "law", "principle"],
    "fact": ["theory", "hypothesis", "conjecture"],
    "cause": ["effect", "result", "outcome"],
    "effect": ["cause", "source", "origin"],
    "evidence": ["speculation", "assumption", "belief"],
    "primary": ["secondary", "tertiary", "minor"],
    "secondary": ["primary", "main", "principal"],
    "empirical": ["theoretical", "hypothetical", "conceptual"],
    "qualitative": ["quantitative", "numerical", "statistical"],
    "quantitative": ["qualitative", "descriptive", "narrative"],
    
    // Business/economic terms
    "profit": ["loss", "deficit", "debt"],
    "loss": ["profit", "gain", "revenue"],
    "growth": ["decline", "reduction", "contraction"],
    "decline": ["growth", "increase", "expansion"],
    "investment": ["expense", "cost", "expenditure"],
    "expense": ["revenue", "income", "profit"],
    "revenue": ["cost", "expense", "expenditure"],
    "market": ["regulation", "control", "restriction"],
    "public": ["private", "proprietary", "exclusive"],
    "private": ["public", "communal", "shared"],
    
    // Technology terms
    "software": ["hardware", "equipment", "device"],
    "hardware": ["software", "program", "application"],
    "digital": ["analog", "physical", "manual"],
    "online": ["offline", "disconnected", "local"],
    "offline": ["online", "connected", "remote"],
    "automatic": ["manual", "controlled", "supervised"],
    "manual": ["automatic", "automated", "autonomous"],
    
    // Medical/health terms
    "acute": ["chronic", "long-term", "persistent"],
    "chronic": ["acute", "short-term", "temporary"],
    "treatment": ["diagnosis", "assessment", "evaluation"],
    "diagnosis": ["treatment", "therapy", "intervention"],
    "prevention": ["treatment", "cure", "remedy"],
    "cure": ["prevention", "prophylaxis", "deterrent"],
    
    // General adjectives
    "effective": ["ineffective", "unsuccessful", "futile"],
    "efficient": ["inefficient", "wasteful", "unproductive"],
    "fast": ["slow", "gradual", "leisurely"],
    "slow": ["fast", "rapid", "swift"],
    "simple": ["complex", "complicated", "intricate"],
    "complex": ["simple", "straightforward", "uncomplicated"],
    "direct": ["indirect", "roundabout", "circuitous"],
    "clear": ["ambiguous", "unclear", "vague"],
    "safe": ["dangerous", "hazardous", "risky"],
    "dangerous": ["safe", "secure", "protected"],
    "easy": ["difficult", "challenging", "demanding"],
    "difficult": ["easy", "simple", "straightforward"],
    "beneficial": ["harmful", "detrimental", "damaging"],
    "harmful": ["beneficial", "advantageous", "helpful"],
    "modern": ["traditional", "conventional", "classical"],
    "traditional": ["modern", "contemporary", "current"],
    "active": ["passive", "inactive", "dormant"],
    "passive": ["active", "dynamic", "energetic"],
    "global": ["local", "regional", "domestic"],
    "local": ["global", "international", "worldwide"],
    "reliable": ["unreliable", "inconsistent", "unpredictable"],
    "common": ["rare", "uncommon", "unusual"],
    "rare": ["common", "frequent", "prevalent"]
  };
  
  // Clean the word (remove punctuation, make lowercase)
  const cleanWord = word.toLowerCase().replace(/[.,;:!?()]/g, '');
  
  // Check for direct matches
  if (alternatives[cleanWord]) {
    const options = alternatives[cleanWord];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  // Check for words with common suffixes and transform them
  const suffixReplacements = [
    { suffix: 'ing', transform: (w: string) => w + 'ed' },
    { suffix: 'ed', transform: (w: string) => w + 'ing' },
    { suffix: 'able', transform: (w: string) => 'not ' + w },
    { suffix: 'ly', transform: (w: string) => w.slice(0, -2) + 'less' },
    { suffix: 'ful', transform: (w: string) => w.slice(0, -3) + 'less' },
    { suffix: 'less', transform: (w: string) => w.slice(0, -4) + 'ful' },
    { suffix: 'ive', transform: (w: string) => 'non-' + w }
  ];
  
  for (const { suffix, transform } of suffixReplacements) {
    if (cleanWord.endsWith(suffix) && cleanWord.length > suffix.length + 3) {
      return transform(cleanWord);
    }
  }
  
  // Try adding common prefixes for negation
  const negationPrefixes = ['un', 'in', 'non', 'dis', 'anti'];
  // Check if the word already has a negation prefix
  for (const prefix of negationPrefixes) {
    if (cleanWord.startsWith(prefix) && cleanWord.length > prefix.length + 3) {
      // Remove the prefix
      return cleanWord.slice(prefix.length);
    }
  }
  
  // Add a negation prefix if the word doesn't have one
  if (cleanWord.length > 4 && !/^(un|in|non|dis|anti)/.test(cleanWord)) {
    // Choose a random prefix
    const prefix = negationPrefixes[Math.floor(Math.random() * negationPrefixes.length)];
    // Check if adding the prefix sounds natural
    if (!/^[aeiou]/.test(cleanWord) || prefix !== 'in') {
      return prefix + cleanWord;
    }
  }
  
  // Last resort: return a modified version of the original
  return "non-" + cleanWord;
}

function createExamStyleOptions(
  correctAnswer: string, 
  facts: string[], 
  difficultyLevel: DifficultyLevel = 'normal'
): string[] {
  // Extract some context from the correct answer to help generate better distractors
  const words = correctAnswer.split(' ');
  const context = words.length > 3 ? words.slice(0, 3).join(' ') : correctAnswer;
  
  // Make sure the correct answer is properly formatted
  const formattedCorrectAnswer = formatOptionTextForMCQ(correctAnswer);
  
  // Generate distractors
  let distractors = generateExamDistractors(correctAnswer, facts, difficultyLevel);
  
  // Format all distractors
  distractors = distractors.map(distractor => formatOptionTextForMCQ(distractor));
  
  // Ensure options are 100% unique
  const distinctOptions = ensureUniqueOptionsForQuiz([formattedCorrectAnswer, ...distractors], context);
  
  // Return at most 4 options (or 5 for hard difficulty)
  const maxOptions = difficultyLevel === 'hard' ? 5 : 4;
  return shuffleArray(distinctOptions.slice(0, maxOptions));
}

/**
 * Creates true/false questions from extracted facts
 */
function createTrueFalseQuestions(
  facts: string[],
  allText: string,
  difficulty: DifficultyLevel = "medium"
): QuizQuestion[] {
  // Determine number of questions based on difficulty
  const questionCount = 
    difficulty === "easy" ? 3 : 
    difficulty === "medium" ? 5 : 
    7; // hard difficulty
  
  console.log(`Generating ${questionCount} true/false questions...`);
  
  // Need a minimum number of facts to work with
  if (facts.length < 3) {
    console.log("Not enough facts to generate true/false questions");
    return [];
  }
  
  // Shuffle facts and select a subset
  const shuffledFacts = shuffleArray([...facts]);
  const selectedFacts = shuffledFacts.slice(0, Math.min(facts.length, questionCount * 2));
  
  const questions: QuizQuestion[] = [];
  
  // Create questions from selected facts
  for (let i = 0; i < selectedFacts.length && questions.length < questionCount; i++) {
    const fact = selectedFacts[i];
    
    // Skip very short facts
    if (fact.split(/\s+/).length < 5) continue;
    
    // Randomly decide if this will be a true or false statement
    const isTrueStatement = Math.random() > 0.5;
    
    let statement: string;
    let answer: number;
    
    if (isTrueStatement) {
      // Use the fact as-is for a true statement
      statement = fact;
      answer = 0; // "True" is the first option
    } else {
      // Create a false statement by modifying the fact
      statement = createFalseStatement(fact, facts, allText);
      answer = 1; // "False" is the second option
    }
    
    // Format the statement for clarity
    const formattedStatement = formatOptionTextForMCQ(statement);
    
    // Create a clearer question
    const questionText = formattedStatement;
    
    questions.push({
      id: 0, // Will be assigned later
      question: questionText,
      options: ["True", "False"],
      answer,
      type: "single",
      difficulty: difficulty
    });
  }
  
  return questions;
}

/**
 * Creates a false statement from a true statement
 * @param statement The true statement to modify
 * @returns A false statement
 */
function createFalseStatement(statement: string, facts: string[], allText: string): string {
  // Strategy 1: Negation - Change positive to negative or vice versa
  if (Math.random() < 0.25) {
    // Common patterns to negate
    const patterns = [
      { regex: /\b(is|are|was|were)\b/i, replace: (match: string) => match + ' not' },
      { regex: /\b(has|have|had)\b/i, replace: (match: string) => match.toLowerCase() === 'has' ? 'does not have' : 'do not have' },
      { regex: /\b(can|could|will|would|should|must)\b/i, replace: (match: string) => match + ' not' },
      { regex: /\b(does|do|did)\b/i, replace: (match: string) => match + ' not' }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(statement)) {
        return statement.replace(pattern.regex, pattern.replace);
      }
    }
    
    // If we couldn't find a specific pattern to negate, try adding "not" at an appropriate position
    const words = statement.split(' ');
    for (let i = 0; i < words.length; i++) {
      if (/^(the|a|an|this|that|these|those)$/i.test(words[i]) && i + 1 < words.length) {
        // Insert "not" after an article or demonstrative
        words.splice(i + 2, 0, 'not');
        return words.join(' ');
      }
    }
  }
  
  // Strategy 2: Term replacement - Replace a key term with its opposite or alternative
  if (Math.random() < 0.5) {
    const words = statement.split(' ');
    
    // Find words with 4+ characters that might be important
    const candidates: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[.,;:!?()]/g, '');
      if (word.length > 3 && !/^(that|this|with|from|there|their|about)$/i.test(word)) {
        candidates.push(i);
      }
    }
    
    if (candidates.length > 0) {
      // Choose a random candidate
      const index = candidates[Math.floor(Math.random() * candidates.length)];
      const word = words[index].replace(/[.,;:!?()]/g, '');
      
      // Replace with alternative term
      const alternative = getAlternativeTerm(word);
      words[index] = words[index].replace(word, alternative);
      
      return words.join(' ');
    }
  }
  
  // Strategy 3: Numeric modification - Change numbers in the statement
  const numberRegex = /\b(\d+([,.]\d+)?)\b/g;
  let match;
  const statementWithNumbers = statement.slice();
  
  if ((match = numberRegex.exec(statement)) !== null) {
    let number = parseFloat(match[1].replace(',', '.'));
    
    // Modify the number
    if (number < 10) {
      number = number * 2 + 1; // Small numbers: double and add 1
    } else if (number < 100) {
      number = Math.round(number * 1.5); // Medium numbers: increase by 50%
    } else {
      number = Math.round(number * 0.7); // Large numbers: decrease by 30%
    }
    
    // Replace the number in the statement
    return statement.replace(match[0], number.toString());
  }
  
  // Strategy 4: Subject-object reversal for sentences with clear structure
  const subjectVerbObjectRegex = /\b([A-Z]\w+(?: \w+){0,3}) (is|are|was|were) ((?:(?!is|are|was|were)\w+)(?: \w+){0,3})\b/i;
  if ((match = subjectVerbObjectRegex.exec(statement)) !== null) {
    const subject = match[1];
    const verb = match[2];
    const object = match[3];
    
    // Reverse subject and object
    return `${object} ${verb} ${subject}`;
  }
  
  // Last resort: Add "not" to the beginning of the statement
  return "It is not true that " + statement;
}

/**
 * Format options to ensure they are concise and appropriate for MCQs
 * This function transforms lengthy text extracts into brief, focused options
 * @param option The option text to format
 * @returns Formatted, concise option text
 */
function formatOptionTextForMCQ(option: string): string {
  if (!option || option.trim().length === 0) return "Information not available";
  
  // Clean the option text
  let formatted = option.trim();
  
  // Remove awkward phrasings
  formatted = formatted
    .replace(/^according to the (document|text|passage|content),?\s*/i, '')
    .replace(/^based on the (document|text|passage|content),?\s*/i, '')
    .replace(/\bin the (document|text|passage|content)\b/i, '')
    .replace(/\bas (stated|mentioned|described|noted|indicated) in the (document|text|passage|content)\b/i, '');
  
  // Fix questions that start with "Which of the following..."
  if (formatted.match(/^which of the following/i)) {
    formatted = formatted
      // Remove awkward phrasing
      .replace(/are associated with/i, 'are characteristics of')
      .replace(/are correctly identified as/i, 'are')
      .replace(/elements are/i, 'are')
      .replace(/statements is/i, 'is')
      .replace(/best represents/i, 'is')
      .replace(/is accurately described as/i, 'is')
      
      // Fix common awkward question structures
      .replace(/which of the following (is|are) (.*?) of (.*?)\?/i, 'What $2 of $3?')
      .replace(/which of the following best describes (.*?)\?/i, 'What is $1?')
      .replace(/which of the following best defines (.*?)\?/i, 'What is the definition of $1?')
      .replace(/which of the following best characterizes (.*?)\?/i, 'What characterizes $1?');
      
    // If we still have "which of the following", make it more direct
    if (formatted.match(/^which of the following/i)) {
      formatted = formatted
        .replace(/^which of the following (is|are) (.*?)\?/i, 'What $2?');
    }
  }
  
  // Fix questions that are about statements
  formatted = formatted
    .replace(/which statement about (.*?) is (correct|true|accurate|valid)/i, 'What is true about $1?')
    .replace(/which of the following statements about (.*?) is (correct|true|accurate|valid)/i, 'What is true about $1?')
    .replace(/which of the statements (below|above) (is|are) (correct|true|accurate|valid)/i, 'Which statement is true?')
    .replace(/which (is|are) (not|false) (correct|true|accurate|valid)/i, 'Which is incorrect?');
  
  // Fix other common awkward phrasings
  formatted = formatted
    .replace(/\bwith a\b/i, 'in a')
    .replace(/\b(typically|generally|commonly|usually|normally|primarily|essentially|frequently|often|sometimes|occasionally),\s*/i, '')
    .replace(/\bplease (identify|select|choose|pick)\b/i, 'What is')
    .replace(/\bcan be best described as\b/i, 'is')
    .replace(/\bis best characterized as\b/i, 'is');
  
  // Fix awkward questions about definition/meaning/purpose
  formatted = formatted
    .replace(/what (is|are) the (definition|meaning|purpose|goal|objective|aim|function|role) of (.*?)\?/i, 'What is $3?')
    .replace(/what does (.*?) (mean|refer to|indicate|signify|represent)\?/i, 'What is $1?');
    
  // Make comparative questions clearer
  formatted = formatted
    .replace(/how does (.*?) (differ|compare) (from|to|with) (.*?)\?/i, 'What differentiates $1 from $4?')
    .replace(/what is the (main|primary|key|significant|major) difference between (.*?) and (.*?)\?/i, 'What differentiates $2 from $3?');
  
  // Replace double spaces
  formatted = formatted.replace(/\s{2,}/g, ' ').trim();
  
  // Ensure the question ends with a question mark
  if (!formatted.endsWith('?')) {
    formatted += '?';
  }
  
  // Make sure the first letter is capitalized
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Ensures options are concise and formatted as proper MCQ choices
 * @param options Array of option texts
 * @param context The context (e.g., subject) for generating alternatives
 * @returns Array of concise MCQ options
 */
function ensureUniqueOptionsForQuiz(options: string[], context: string = ''): string[] {
  // First format all options to be concise
  let formattedOptions = options.map(opt => formatOptionTextForMCQ(opt));
  
  // Track which options we've seen by their core content (lowercase, trimmed)
  const seenContent = new Map<string, boolean>();
  const seenPhrases = new Set<string>();
  const result: string[] = [];
  
  // Enhanced alternative templates for more professional and academically appropriate distractors
  const alternativeTemplates = [
    `${context} applies only in specific contexts, not as a general principle.`,
    `${context} is related to other systems, but not directly applicable here.`,
    `This is a common misconception about ${context} that has been disproven.`,
    `${context} was historically viewed this way, but modern understanding differs.`,
    `This applies to a related concept, but not to ${context} specifically.`,
    `This represents a theoretical aspect of ${context} that hasn't been validated in practice.`,
    `This contradicts the established principles of ${context}.`,
    `This contains partial information about ${context} but omits critical elements.`,
    `${context} has been shown to have the opposite effect in controlled studies.`,
    `This confuses ${context} with another related but distinct concept.`,
    `Research indicates a more nuanced relationship with ${context} than this suggests.`,
    `While popular in non-academic contexts, this view of ${context} lacks empirical support.`,
    `The relationship with ${context} is correlational rather than causal as suggested.`,
    `This represents an outdated paradigm regarding ${context} that has since been revised.`,
    `This oversimplifies the complex mechanisms underlying ${context}.`,
    `The current scientific consensus contradicts this interpretation of ${context}.`,
    `This is based on an incomplete understanding of how ${context} functions.`,
    `This statement conflates ${context} with its effects rather than its causes.`,
    `This overgeneralizes findings about ${context} beyond their applicable domain.`,
    `This reverses the actual relationship between cause and effect regarding ${context}.`
  ];
  
  // Process each option and guarantee uniqueness
  for (let i = 0; i < formattedOptions.length && result.length < 4; i++) {
    const option = formattedOptions[i];
    if (!option || option.trim().length < 10) continue; // Skip empty or very short options
    
    const lowerOption = option.toLowerCase().trim();
    
    // Extract key phrases (3+ word phrases) to detect semantic similarity
    const words = lowerOption.split(/\s+/);
    const keyPhrases = [];
    for (let j = 0; j < words.length - 2; j++) {
      keyPhrases.push(words.slice(j, j + 3).join(' '));
    }
    
    // Check if this option is too similar to one we've seen
    let isTooSimilar = false;
    
    // Check for exact match or high overlap in key phrases
    if (seenContent.has(lowerOption)) {
      isTooSimilar = true;
    } else {
      // Check for phrase overlap
      for (const phrase of keyPhrases) {
        if (phrase.length > 10 && seenPhrases.has(phrase)) {
          isTooSimilar = true;
          break;
        }
      }
    }
    
    // If too similar or too short, replace it
    if (isTooSimilar || option.length < 15) {
      // If this is the correct answer (first option), we must keep it
      // but ensure it's distinct from any options we've already added
      if (i === 0 && result.length > 0) {
        // Keep the original content but make it clearly distinct
        const cleanOption = option.replace(/^The /i, '').replace(/\.$/, '');
        formattedOptions[i] = `The accurate definition of ${context} is: ${cleanOption}.`;
      } else {
        // For distractors, replace with a sophisticated alternative
        const altIndex = Math.floor(Math.random() * alternativeTemplates.length);
        formattedOptions[i] = alternativeTemplates[altIndex];
        
        // If we've used this template before, make it unique by adding a qualifier
        if (seenContent.has(formattedOptions[i].toLowerCase().trim())) {
          const qualifiers = [
            "Research shows",
            "Studies indicate",
            "Evidence suggests",
            "Experts maintain",
            "Analysis reveals",
            "Most specialists agree",
            "Current literature confirms",
            "Peer-reviewed studies demonstrate",
            "Contemporary research indicates",
            "Academic consensus suggests"
          ];
          const qualifier = qualifiers[Math.floor(Math.random() * qualifiers.length)];
          formattedOptions[i] = `${qualifier} that ${formattedOptions[i].charAt(0).toLowerCase()}${formattedOptions[i].slice(1)}`;
        }
      }
    }
    
    // Before adding to result, ensure this option is properly formatted
    let finalOption = formattedOptions[i];
    
    // Don't add if already exactly present
    if (result.some(existingOpt => existingOpt.toLowerCase() === finalOption.toLowerCase())) {
      continue;
    }
    
    // Ensure option ends with a period
    if (!finalOption.endsWith('.') && !finalOption.endsWith('?') && !finalOption.endsWith('!')) {
      finalOption += '.';
    }
    
    // Ensure option starts with a capital letter
    if (finalOption.length > 0 && finalOption[0].toLowerCase() === finalOption[0]) {
      finalOption = finalOption.charAt(0).toUpperCase() + finalOption.slice(1);
    }
    
    // Add to our result and mark as seen
    result.push(finalOption);
    seenContent.set(finalOption.toLowerCase().trim(), true);
    
    // Mark key phrases as seen
    for (const phrase of keyPhrases) {
      if (phrase.length > 10) {
        seenPhrases.add(phrase);
      }
    }
  }
  
  // If we have fewer than 4 options, add more sophisticated ones
  while (result.length < 4) {
    // Generate a new option that isn't too similar to existing ones
    const altIndex = Math.floor(Math.random() * alternativeTemplates.length);
    let newOption = alternativeTemplates[altIndex];
    
    // Ensure uniqueness
    if (seenContent.has(newOption.toLowerCase().trim())) {
      const contextWords = context.split(/\s+/);
      const subjectWord = contextWords[contextWords.length - 1]; // Get last word as fallback
      
      const alternativeFormats = [
        `Research in ${context} has not validated this approach.`,
        `This applies to ${subjectWord}-adjacent fields but not ${context} itself.`,
        `This is based on outdated information about ${context}.`,
        `This confuses correlation with causation regarding ${context}.`,
        `The empirical evidence does not support this claim about ${context}.`,
        `This greatly oversimplifies the complexity associated with ${context}.`,
        `This represents a theoretical rather than practical understanding of ${context}.`,
        `This conflates different aspects of ${context} that should be considered separately.`
      ];
      
      newOption = alternativeFormats[Math.floor(Math.random() * alternativeFormats.length)];
    }
    
    // Ensure option ends with a period
    if (!newOption.endsWith('.') && !newOption.endsWith('?') && !newOption.endsWith('!')) {
      newOption += '.';
    }
    
    // Ensure option starts with a capital letter
    if (newOption.length > 0 && newOption[0].toLowerCase() === newOption[0]) {
      newOption = newOption.charAt(0).toUpperCase() + newOption.slice(1);
    }
    
    // Add to results if not already present
    if (!result.some(existingOpt => existingOpt.toLowerCase() === newOption.toLowerCase())) {
      result.push(newOption);
      seenContent.set(newOption.toLowerCase().trim(), true);
    }
  }
  
  // If we have more than 4 options, keep only the first 4
  if (result.length > 4) {
    return result.slice(0, 4);
  }
  
  return result;
}

/**
 * Generate concise, focused distractors for exam-style questions
 */
function generateExamDistractorsAlt(
  correctAnswer: string,
  facts: string[],
  difficultyLevel: DifficultyLevel
): string[] {
  // ... existing code ...
}