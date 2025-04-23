import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

/**
 * Helper function to get the current session on the server
 * Used in API routes to check authentication
 */
export async function auth() {
  return await getServerSession(authOptions);
} 