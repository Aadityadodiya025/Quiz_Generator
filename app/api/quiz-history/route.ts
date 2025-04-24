import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@/lib/auth";

// API route to save quiz history
export async function POST(req: NextRequest) {
  try {
    // Get the user session
    const session = await auth();

    // If no authenticated user, return error
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        message: "User not authenticated"
      }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;
    
    // Parse request body
    const quizData = await req.json();
    
    // Validate required fields
    if (!quizData.quizId || !quizData.title || quizData.score === undefined) {
      return NextResponse.json({
        success: false,
        message: "Missing required quiz data"
      }, { status: 400 });
    }
    
    // Connect to database
    const { db, client } = await connectToDatabase();
    
    if (!db) {
      console.error("Failed to connect to database");
      return NextResponse.json({ 
        success: false,
        message: "Database connection failed"
      }, { status: 500 });
    }
    
    try {
      // Prepare quiz result document
      const quizResult = {
        userId,
        quizId: quizData.quizId,
        title: quizData.title,
        score: quizData.score,
        totalQuestions: quizData.totalQuestions || 0,
        correctAnswers: quizData.correctAnswers || 0,
        date: quizData.date || new Date().toISOString(),
        timeTaken: quizData.timeTaken || 0,
        difficulty: quizData.difficulty || "medium",
        topic: quizData.topic || null,
        createdAt: new Date()
      };
      
      // Insert the quiz result
      const result = await db.collection("quiz_results").insertOne(quizResult);
      
      if (result.acknowledged) {
        return NextResponse.json({
          success: true,
          message: "Quiz history saved successfully",
          id: result.insertedId
        });
      } else {
        throw new Error("Failed to insert quiz result");
      }
      
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ 
        success: false,
        message: "Error saving quiz data"
      }, { status: 500 });
    } finally {
      // Close the database connection
      if (client) {
        await client.close();
      }
    }
    
  } catch (error) {
    console.error("Error in quiz-history API:", error);
    return NextResponse.json({ 
      success: false,
      message: "Server error"
    }, { status: 500 });
  }
}

// API route to get quiz history for the current user
export async function GET(req: NextRequest) {
  try {
    // Get the user session
    const session = await auth();

    // If no authenticated user, return error
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        message: "User not authenticated",
        history: []
      }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;
    
    // Connect to database
    const { db, client } = await connectToDatabase();
    
    if (!db) {
      console.error("Failed to connect to database");
      return NextResponse.json({ 
        success: false,
        message: "Database connection failed",
        history: []
      }, { status: 500 });
    }
    
    try {
      // Query for this user's quiz history
      const history = await db.collection("quiz_results")
        .find({ userId })
        .sort({ date: -1 })
        .limit(50)
        .toArray();
      
      return NextResponse.json({
        success: true,
        message: "Quiz history retrieved successfully",
        history
      });
      
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ 
        success: false,
        message: "Error retrieving quiz history",
        history: []
      }, { status: 500 });
    } finally {
      // Close the database connection
      if (client) {
        await client.close();
      }
    }
    
  } catch (error) {
    console.error("Error in quiz-history API:", error);
    return NextResponse.json({ 
      success: false,
      message: "Server error",
      history: []
    }, { status: 500 });
  }
} 