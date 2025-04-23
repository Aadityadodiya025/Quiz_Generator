"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  redirectPath?: string
}

export function LoginModal({ isOpen, onClose, redirectPath = "/" }: LoginModalProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Improved retry logic for database connection issues
      let retryCount = 0;
      const maxRetries = 3;
      let result;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`Login attempt ${retryCount + 1} for ${email}`);
          result = await signIn("credentials", {
            redirect: false,
            email,
            password,
          });
          
          // If we got a response, break out of the retry loop
          break;
          
        } catch (signInError) {
          console.error(`Sign-in attempt ${retryCount + 1} failed:`, signInError);
          retryCount++;
          
          // If we've reached max retries, continue to error handling
          if (retryCount >= maxRetries) {
            throw signInError;
          }
          
          // Wait before retrying (exponential backoff)
          const backoffTime = 1000 * Math.pow(2, retryCount - 1);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(r => setTimeout(r, backoffTime));
        }
      }

      if (result?.error) {
        // Handle specific error cases for better user feedback
        if (result.error.includes("No user found")) {
          toast({
            title: "Account Not Found",
            description: "No account found with this email. Would you like to sign up instead?",
            variant: "destructive",
            action: (
              <Button 
                variant="outline" 
                onClick={() => {
                  onClose();
                  const event = new CustomEvent('openSignupModal');
                  window.dispatchEvent(event);
                }}
                className="bg-white hover:bg-gray-100 text-gray-800"
              >
                Sign Up
              </Button>
            ),
          });
        } else if (result.error.includes("Invalid password")) {
          toast({
            title: "Incorrect Password",
            description: "The password you entered is incorrect. Please try again.",
            variant: "destructive",
          });
        } else if (result.error.includes("Database connection")) {
          toast({
            title: "Connection Error",
            description: "We're having trouble connecting to our database. Please try again in a few moments.",
            variant: "destructive",
            action: (
              <Button 
                variant="outline" 
                onClick={() => {
                  setLoading(true);
                  setTimeout(() => handleSubmit(e), 1000);
                }}
                className="bg-white hover:bg-gray-100 text-gray-800"
              >
                Retry
              </Button>
            ),
          });
        } else {
          toast({
            title: "Login Failed",
            description: result.error || "An unexpected error occurred",
            variant: "destructive",
          });
        }
      } else if (result?.ok) {
        // Login successful
        console.log("Login successful, redirecting user...");
        
        toast({
          title: "Success",
          description: "You have been logged in successfully",
        });

        // Close the modal first
        onClose();
        
        // Force a router refresh to update authentication state
        router.refresh();
        
        // Add a small delay before redirecting to ensure session is properly set
        setTimeout(() => {
          // If we have a redirectPath, navigate there, otherwise go to profile
          if (redirectPath && redirectPath !== "/login" && redirectPath !== "/signup") {
            console.log(`Redirecting to: ${redirectPath}`);
            router.push(redirectPath);
          } else {
            console.log("Redirecting to profile page");
            router.push("/profile");
          }
        }, 300);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Login Required</DialogTitle>
          <DialogDescription>
            Please log in to your account to access this feature
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="mt-4 sm:mt-0 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline" onClick={onClose}>
                Sign up
              </Link>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
