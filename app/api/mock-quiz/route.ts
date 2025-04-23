import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock quiz data
    const mockQuizData = {
      success: true,
      data: {
        title: "Sample Quiz",
        questions: [
          {
            id: 1,
            question: "What is the primary purpose of a PDF document?",
            options: [
              "To store only images",
              "To present documents in a fixed layout",
              "To edit documents collaboratively",
              "To compress video files"
            ],
            answer: 1
          },
          {
            id: 2,
            question: "PDF stands for:",
            options: [
              "Portable Document Format",
              "Printed Document File",
              "Public Domain Format",
              "Protected Digital File"
            ],
            answer: 0
          },
          {
            id: 3,
            question: "Which company created the PDF format?",
            options: [
              "Microsoft",
              "Apple",
              "Adobe",
              "IBM"
            ],
            answer: 2
          },
          {
            id: 4,
            question: "Which of these is an advantage of PDF files?",
            options: [
              "Easy to edit content",
              "Small file size for all documents",
              "Consistent appearance across devices",
              "Native support for animations"
            ],
            answer: 2
          },
          {
            id: 5,
            question: "What year was the PDF format first released?",
            options: [
              "1983",
              "1993",
              "2003",
              "2013"
            ],
            answer: 1
          }
        ]
      }
    };

    return NextResponse.json(mockQuizData);
  } catch (error) {
    console.error("Error in mock quiz API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate mock quiz" },
      { status: 500 }
    );
  }
} 