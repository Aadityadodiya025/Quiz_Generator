import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { auth } from "@/lib/auth";

/**
 * Parse duration string to seconds
 * Handles formats like "1:30", "90", "1m30s", etc.
 */
function parseDurationToSeconds(duration: any): number {
  // If it's already a number, return it
  if (typeof duration === 'number') {
    return duration;
  }
  
  // If it's undefined or null, return 0
  if (duration == null) {
    return 0;
  }
  
  // If it's a string that contains a colon (like "1:30"), parse it as minutes:seconds
  if (typeof duration === 'string' && duration.includes(':')) {
    const parts = duration.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return minutes * 60 + seconds;
    }
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  
  // If it's a string with 'm' and 's' (like "1m30s"), parse accordingly
  if (typeof duration === 'string' && (duration.includes('m') || duration.includes('s'))) {
    let seconds = 0;
    
    // Extract minutes
    const minutesMatch = duration.match(/(\d+)m/);
    if (minutesMatch) {
      seconds += parseInt(minutesMatch[1], 10) * 60;
    }
    
    // Extract seconds
    const secondsMatch = duration.match(/(\d+)s/);
    if (secondsMatch) {
      seconds += parseInt(secondsMatch[1], 10);
    }
    
    return seconds;
  }
  
  // Try parsing as a direct number
  const parsed = parseInt(duration, 10);
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  // Default to 0 if nothing else works
  return 0;
}

export async function POST(req: Request) {
  try {
    // Connect to database
    await connectDB();

    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { message: "You must be logged in to save video summary history" },
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
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 }
      );
    }
    
    const { videoId, title, url, summary, duration } = body;

    // Validate required fields
    if (!videoId || !title || !summary) {
      return NextResponse.json(
        { message: "VideoId, title, and summary are required" },
        { status: 400 }
      );
    }

    // Convert duration to seconds for database storage
    const durationInSeconds = parseDurationToSeconds(duration);

    // Find the user and update their video summary history
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $push: {
          videoSummaryHistory: {
            videoId,
            title,
            url: url || `https://www.youtube.com/watch?v=${videoId}`,
            summary,
            duration: durationInSeconds,
            date: new Date(),
          },
        },
      },
      { new: true }
    ).catch((error) => {
      console.error("Error updating user:", error);
      return null;
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found or database error occurred" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Video summary saved to history",
        videoSummaryCount: user.videoSummaryHistory.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving video summary to history:", error);
    return NextResponse.json(
      { message: "Failed to save video summary to history" },
      { status: 500 }
    );
  }
} 