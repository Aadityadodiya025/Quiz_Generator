import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to set quiz difficulty level
 * 
 * @param req Request with difficulty level data
 * @returns Response with the processed difficulty level
 */
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const data = await req.json();
    const { level } = data;
    
    // Validate the level (now supporting 'easy', 'medium', 'hard' directly)
    const validLevels = ['easy', 'medium', 'hard', 'normal'];
    
    // Map 'normal' to 'medium' for consistency with the upload API
    const normalizedLevel = level === 'normal' ? 'medium' : level;
    
    if (!normalizedLevel || !validLevels.includes(normalizedLevel)) {
      return NextResponse.json(
        { error: 'Invalid difficulty level. Must be one of: easy, medium/normal, hard' },
        { status: 400 }
      );
    }
    
    // Here you would typically store this in a session or database
    // For now, we'll just return a confirmation
    
    return NextResponse.json({
      success: true,
      level: normalizedLevel,
      description: getLevelDescription(normalizedLevel),
      questionCount: getQuestionCountForLevel(normalizedLevel)
    });
  } catch (error: any) {
    console.error('Error processing quiz level:', error);
    return NextResponse.json(
      { error: 'Failed to process quiz level' },
      { status: 500 }
    );
  }
}

/**
 * Get a description of what each difficulty level means
 */
function getLevelDescription(level: string): string {
  switch (level) {
    case 'easy':
      return 'Basic questions covering main concepts with straightforward answers';
    case 'medium':
      return 'Moderate difficulty with more specific questions and detailed answer options';
    case 'hard':
      return 'Challenging questions requiring deeper understanding and detailed knowledge';
    default:
      return 'Unknown difficulty level';
  }
}

/**
 * Get the recommended number of questions for each difficulty level
 */
function getQuestionCountForLevel(level: string): number {
  switch (level) {
    case 'easy':
      return 5;
    case 'medium':
      return 10;
    case 'hard':
      return 15;
    default:
      return 10;
  }
} 