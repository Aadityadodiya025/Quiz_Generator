import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function PUT(request: Request) {
  try {
    // Get the authenticated user session
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const body = await request.json();
    const { name, email, currentPassword, newPassword } = body;
    
    // Connect to the database
    await dbConnect();
    
    // Find the user by email from the session
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }
    
    // Initialize updates object
    const updates: any = {};
    
    // Update name if provided
    if (name && name !== user.name) {
      updates.name = name;
    }
    
    // Update email if provided and different from current
    if (email && email !== user.email) {
      // Check if email is already in use by another account
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return NextResponse.json(
          { success: false, message: "Email already in use" },
          { status: 400 }
        );
      }
      updates.email = email;
    }
    
    // Update password if both current and new passwords are provided
    if (currentPassword && newPassword) {
      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, message: "Current password is incorrect" },
          { status: 400 }
        );
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updates.password = hashedPassword;
    }
    
    // If there are no updates, return early
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: true, message: "No changes were made" },
        { status: 200 }
      );
    }
    
    // Update the user in the database
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { new: true }
    ).select("-password");
    
    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        name: updatedUser.name,
        email: updatedUser.email
      }
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update profile" },
      { status: 500 }
    );
  }
} 