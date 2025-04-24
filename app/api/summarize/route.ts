import { NextRequest, NextResponse } from "next/server"
import * as pdfParse from 'pdf-parse'

export const config = {
  api: {
    bodyParser: false
  }
}

interface Topic {
  title: string;
  keyPoints: string[];
}

export async function POST(req: NextRequest) {
  try {
    console.log("Received request to /api/summarize")
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      console.error("No file uploaded or invalid file")
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      )
    }

    console.log("File received:", file instanceof File ? file.name : 'blob')

    if (!file.type.includes('pdf')) {
      console.error("File is not a PDF:", file.type)
      return NextResponse.json(
        { success: false, message: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    try {
      console.log("Processing PDF file...")
      const buffer = Buffer.from(await file.arrayBuffer())
      console.log("PDF buffer created, size:", buffer.length)
      
      // @ts-ignore
      const pdfData = await pdfParse(buffer, { max: 100 })
      console.log("PDF parsed successfully, text length:", pdfData.text.length)
      
      const content = pdfData.text

      if (!content || content.trim().length === 0) {
        console.error("No content found in PDF")
        return NextResponse.json(
          { success: false, message: "No content found in PDF" },
          { status: 400 }
        )
      }

      // Clean and prepare content for processing
      const cleanedContent = cleanText(content)
      
      // Extract sections from the content
      console.log("Extracting sections from content...")
      const sections = extractSections(cleanedContent)
      console.log(`Extracted ${sections.length} sections`)

      // Generate topics from the content
      console.log("Identifying topics and key points...")
      const topics = identifyTopics(cleanedContent, sections)
      console.log(`Identified ${topics.length} topics`)
      
      if (!topics || topics.length === 0) {
        console.error("Could not identify topics")
        return NextResponse.json(
          { success: false, message: "Could not generate summary" },
          { status: 400 }
        )
      }

      // Create response
      const documentTitle = file instanceof File ? file.name.split('.')[0] : "Document"
      console.log("Sending response with topics:", topics.map(t => t.title).join(", "))
      
      return NextResponse.json({
        success: true,
        data: {
          title: documentTitle + " - Comprehensive Summary",
          topics: topics
        }
      })

    } catch (error) {
      console.error('PDF processing error:', error)
      return NextResponse.json(
        { success: false, message: "Error processing PDF file" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Request error:', error)
    return NextResponse.json(
      { success: false, message: "Error handling request" },
      { status: 500 }
    )
  }
}

/**
 * Clean and normalize text from PDF
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/ {2,}/g, ' ') // Remove extra spaces
    .replace(/[^\w\s.,;:?!()\[\]{}'"«»""''&@#$%^*+=-]/g, '') // Remove unusual characters
    .replace(/\n([a-z])/g, ' $1'); // Join broken sentences
}

/**
 * Extract potential sections from the content
 */
function extractSections(content: string): string[] {
  // Split content into paragraphs
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  
  // Look for section patterns - uppercase text, numbering, or typical headings
  const sectionPatterns = [
    /^([A-Z][A-Z\s]+[A-Z])[:\.\s-]/m,       // ALL CAPS heading
    /^(\d+\.\s+[A-Z][a-zA-Z\s]+)[:\.\s-]/m, // Numbered sections like "1. Introduction"
    /^(Chapter \d+)[:\.\s-]/im,             // Chapter headings
    /^([A-Z][a-zA-Z\s]*(?:Introduction|Summary|Overview|Conclusion|Discussion|Method|Result|Analysis|Background|Theory))[:\.\s-]/m // Common section names
  ]
  
  // Extract sections based on patterns
  const sections: string[] = []
  
  for (const paragraph of paragraphs) {
    let isSection = false
    for (const pattern of sectionPatterns) {
      const match = paragraph.match(pattern)
      if (match) {
        isSection = true
        sections.push(match[1].trim())
        break
      }
    }
    
    // Also look for short paragraphs that might be headings
    if (!isSection && paragraph.trim().length < 60 && paragraph.trim().split(/\s+/).length < 8 && 
        /^[A-Z][a-zA-Z\s]+$/.test(paragraph.trim())) {
      sections.push(paragraph.trim())
    }
  }
  
  // If no sections found, create artificial ones based on content length
  if (sections.length < 2) {
    const totalWords = content.split(/\s+/).length
    const sectionSize = Math.max(300, Math.floor(totalWords / 5))
    
    const words = content.split(/\s+/)
    for (let i = 0; i < words.length; i += sectionSize) {
      // Find a good point to break the section
      let j = Math.min(i + sectionSize, words.length - 1)
      while (j > i && !words[j].endsWith('.')) j--
      if (j <= i) j = Math.min(i + sectionSize, words.length - 1)
      
      const sectionWords = words.slice(i, j + 1)
      const sectionText = sectionWords.join(' ')
      const firstSentence = sectionText.split('.')[0]
      
      // Create an appropriate section title
      sections.push(`Topic ${sections.length + 1}: ${firstSentence.substring(0, 40)}...`)
    }
  }
  
  return sections
}

/**
 * Identify topics and extract key points for each topic
 */
function identifyTopics(content: string, sections: string[]): Topic[] {
  // If we have no sections, just process the entire content
  if (sections.length === 0) {
    const keyPoints = generateKeyPoints(content)
    return [{ 
      title: "Document Overview", 
      keyPoints: keyPoints
    }]
  }
  
  // Parse the content into sections and extract key points for each
  const topics: Topic[] = []
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  
  let currentSection = 0
  let currentContent: string[] = []
  
  // Assign paragraphs to sections
  for (const paragraph of paragraphs) {
    // Check if this paragraph might be the next section heading
    let isSectionHeading = false
    
    for (let i = currentSection + 1; i < sections.length; i++) {
      if (paragraph.includes(sections[i]) || 
          levenshteinDistance(paragraph.toLowerCase(), sections[i].toLowerCase()) < 10) {
        // This is the next section heading
        
        // Process the current section
        if (currentContent.length > 0) {
          const sectionText = currentContent.join('\n\n')
          const keyPoints = generateKeyPoints(sectionText)
          
          if (keyPoints.length > 0) {
            topics.push({
              title: sections[currentSection],
              keyPoints: keyPoints
            })
          }
        }
        
        // Move to the next section
        currentSection = i
        currentContent = []
        isSectionHeading = true
        break
      }
    }
    
    if (!isSectionHeading) {
      currentContent.push(paragraph)
    }
  }
  
  // Process the last section
  if (currentContent.length > 0) {
    const sectionText = currentContent.join('\n\n')
    const keyPoints = generateKeyPoints(sectionText)
    
    if (keyPoints.length > 0) {
      topics.push({
        title: sections[currentSection],
        keyPoints: keyPoints
      })
    }
  }
  
  // If we didn't generate any valid topics, fall back to processing the whole document
  if (topics.length === 0) {
    const keyPoints = generateKeyPoints(content)
    return [{ 
      title: "Document Overview", 
      keyPoints: keyPoints
    }]
  }
  
  return topics
}

/**
 * Generate key points from content with improved accuracy
 */
function generateKeyPoints(content: string): string[] {
  // Extract sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  // Score sentences based on relevance indicators
  const scoredSentences = sentences
    .filter(sentence => {
      const trimmed = sentence.trim()
      return trimmed.split(/\s+/).length > 5 && trimmed.length < 300
    })
    .map(sentence => {
      const trimmed = sentence.trim()
      
      // Calculate relevance score based on indicators of important content
      let score = 0
      
      // Sentences with key terms tend to be important
      const keyTerms = [
        'important', 'significant', 'key', 'major', 'critical', 'essential',
        'primary', 'fundamental', 'crucial', 'central', 'core', 'main',
        'definition', 'defined', 'means', 'refers to', 'describes',
        'example', 'instance', 'illustration', 'demonstrates',
        'result', 'conclusion', 'finding', 'discovered', 'shows', 'reveals',
        'advantage', 'benefit', 'feature', 'function', 'purpose',
        'cause', 'effect', 'impact', 'influence', 'relationship'
      ]
      
      for (const term of keyTerms) {
        if (trimmed.toLowerCase().includes(term)) {
          score += 2
          break
        }
      }
      
      // Sentences with numbers often contain important statistics
      if (/\d+/.test(trimmed)) {
        score += 2
      }
      
      // Sentences with proper nouns are often important
      if (/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/.test(trimmed)) {
        score += 1
      }
      
      // Sentences at the beginning of paragraphs tend to be topic sentences
      if (content.indexOf(trimmed) < content.length * 0.3) {
        score += 1
      }
      
      // Longer sentences often contain more information (but not too long)
      const wordCount = trimmed.split(/\s+/).length
      if (wordCount > 10 && wordCount < 30) {
        score += 1
      }
      
      return { sentence: trimmed, score }
    })
    .sort((a, b) => b.score - a.score)
  
  // Select top sentences as key points, ensuring they're diverse
  const keyPoints: string[] = []
  const usedKeywords = new Set<string>()
  
  for (const { sentence } of scoredSentences) {
    // Skip if we already have enough key points
    if (keyPoints.length >= 15) break
    
    // Extract main keywords from this sentence
    const words = sentence.toLowerCase().split(/\s+/)
    const keywords = words.filter(word => 
      word.length > 4 && 
      !['these', 'those', 'their', 'there', 'about', 'which', 'where'].includes(word)
    )
    
    // Skip if too similar to existing key points
    let isDuplicate = false
    for (const keyword of keywords) {
      if (usedKeywords.has(keyword)) {
        isDuplicate = true
        break
      }
    }
    
    if (!isDuplicate) {
      // Add this as a key point
      keyPoints.push(sentence)
      
      // Remember its keywords
      for (const keyword of keywords) {
        usedKeywords.add(keyword)
      }
    }
  }
  
  // Ensure we have a reasonable number of key points
  return keyPoints.slice(0, 15)
}

/**
 * Calculate Levenshtein distance between two strings
 * (Used for fuzzy matching section headings)
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null))
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  
  return matrix[a.length][b.length]
} 