import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    // Connect to database
    await connectDB();

    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { message: "You must be logged in to view your summary history" },
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

    // Find the user and get their summary history
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Sort by date (newest first)
    const summaryHistory = user.summaryHistory || [];
    const sortedSummaryHistory = [...summaryHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Get video summary history as well
    const videoSummaryHistory = user.videoSummaryHistory || [];
    const sortedVideoSummaryHistory = [...videoSummaryHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json(
      { 
        summaries: sortedSummaryHistory,
        videoSummaries: sortedVideoSummaryHistory
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user summary history:", error);
    return NextResponse.json(
      { message: "Failed to retrieve summary history" },
      { status: 500 }
    );
  }
} 