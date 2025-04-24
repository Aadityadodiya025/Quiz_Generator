import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Get the user session
    const session = await auth();
    
    // If no authenticated user, return empty data
    if (!session?.user) {
      return NextResponse.json({ 
        quizzes: [],
        message: "User not authenticated"
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Connect to database
    const { db, client } = await connectToDatabase();
    
    if (!db) {
      console.error("Failed to connect to database");
      return NextResponse.json({ 
        quizzes: [],
        message: "Database connection failed"
      }, { status: 500 });
    }
    
    try {
      // Fetch quiz results for this user
      const quizResults = await db.collection("quiz_results")
        .find({ userId: userId })
        .sort({ date: -1 })
        .toArray();
      
      // Return the quiz results
      return NextResponse.json({
        quizzes: quizResults || [],
        message: quizResults.length > 0 ? "Quiz data retrieved successfully" : "No quiz data found"
      });
      
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ 
        quizzes: [],
        message: "Error fetching quiz data"
      }, { status: 500 });
    } finally {
      // Close the database connection
      if (client) {
        await client.close();
      }
    }
    
  } catch (error) {
    console.error("Error in user-quizzes API:", error);
    return NextResponse.json({ 
      quizzes: [],
      message: "Server error"
    }, { status: 500 });
  }
} 