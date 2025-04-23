import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // Connect to database
    await connectDB();

    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { message: "You must be logged in to save summary history" },
        { status: 401 }
      );
    }

    // Get the email from the session
    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json(
        { message: "User email not found in session" },
        { status: 400 }
      );
    }

    // Parse request body
    const { title, originalText, summary, wordCount } = await req.json();

    // Validate required fields
    if (!title || !summary) {
      return NextResponse.json(
        { message: "Title and summary are required" },
        { status: 400 }
      );
    }

    // Find the user and update their summary history
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $push: {
          summaryHistory: {
            title,
            originalText: originalText || "",
            summary,
            wordCount: wordCount || 0,
            date: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Summary saved to history",
        summaryCount: user.summaryHistory.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving summary to history:", error);
    return NextResponse.json(
      { message: "Failed to save summary to history" },
      { status: 500 }
    );
  }
} 