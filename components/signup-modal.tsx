"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { TermsPolicyModal } from "@/components/terms-policy-modal"
import { ArrowRightCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SignupModal({ isOpen, onClose }: SignupModalProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [showPasswordError, setShowPasswordError] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })
  const { toast } = useToast()
  const router = useRouter()

  const handleFocusChange = (field: string) => {
    if (field === 'password') {
      setIsPasswordFocused(true)
    } else {
      setIsPasswordFocused(false)
    }
  }

  const validatePassword = (pass: string) => {
    const requirements = {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
    }
    
    setPasswordRequirements(requirements)
    
    const errors = []
    if (!requirements.length) errors.push("Password must be at least 8 characters long")
    if (!requirements.uppercase) errors.push("Password must contain at least one uppercase letter")
    if (!requirements.lowercase) errors.push("Password must contain at least one lowercase letter")
    if (!requirements.number) errors.push("Password must contain at least one number")
    if (!requirements.special) errors.push("Password must contain at least one special character")

    return errors
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setPassword(newPassword)
    
    if (newPassword) {
      const errors = validatePassword(newPassword)
      if (errors.length > 0) {
        setPasswordError(errors.join("\n"))
        setShowPasswordError(true)
      } else {
        setPasswordError("")
        setShowPasswordError(false)
      }
    } else {
      setPasswordError("")
      setShowPasswordError(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Combine first and last name
    const fullName = `${firstName} ${lastName}`.trim();

    if (!termsAccepted || !policyAccepted) {
      toast({
        title: "Accept terms required",
        description: "Please accept both Terms & Conditions and Policy to continue.",
        variant: "destructive",
      })
      return
    }

    if (showPasswordError) {
      toast({
        title: "Password requirements not met",
        description: "Please ensure your password meets all the requirements.",
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Register the user with retry logic
      const registerUser = async (retryCount = 0, maxRetries = 2) => {
        try {
          console.log("Attempting to register user:", { fullName, email });
          const registerResponse = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: fullName,
              email,
              password,
            }),
          });

          const registerData = await registerResponse.json();
          console.log("Registration response:", registerData);

          if (!registerResponse.ok) {
            // Handle specific error cases with better user feedback
            if (registerData.message.includes("already exists")) {
              // Specific popup for existing user
              toast({
                title: "Account Already Exists",
                description: "An account with this email already exists. Would you like to log in instead?",
                variant: "destructive",
                action: (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      onClose();
                      const event = new CustomEvent('openLoginModal');
                      window.dispatchEvent(event);
                    }}
                    className="bg-white hover:bg-gray-100 text-gray-800"
                  >
                    Log In
                  </Button>
                ),
              });
              throw new Error("A user with this email already exists. Please log in instead.");
            } else if (registerData.message.includes("Database connection")) {
              if (retryCount < maxRetries) {
                // Wait and retry with exponential backoff
                const waitTime = 1000 * Math.pow(2, retryCount);
                toast({
                  title: "Connection Issue",
                  description: `Retrying in ${waitTime/1000} seconds...`,
                });
                
                await new Promise(r => setTimeout(r, waitTime));
                return registerUser(retryCount + 1, maxRetries);
              } else {
                toast({
                  title: "Connection Error",
                  description: "We're having trouble connecting to our database. Please try again later.",
                  variant: "destructive",
                  action: (
                    <Button 
                      variant="outline" 
                      onClick={() => handleSubmit(e)}
                      className="bg-white hover:bg-gray-100 text-gray-800"
                    >
                      Retry
                    </Button>
                  ),
                });
                // Return a failure object instead of throwing error
                return { success: false, error: "Database connection failed" };
              }
            } else {
              toast({
                title: "Registration Failed",
                description: registerData.message || 'Registration failed',
                variant: "destructive",
              });
              throw new Error(registerData.message || 'Registration failed');
            }
          }
          
          return registerData;
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            // Don't retry for user already exists
            throw error;
          }
          
          if (retryCount < maxRetries) {
            console.log(`Registration attempt ${retryCount + 1} failed, retrying...`);
            const waitTime = 1000 * Math.pow(2, retryCount);
            await new Promise(r => setTimeout(r, waitTime));
            return registerUser(retryCount + 1, maxRetries);
          }
          
          throw error;
        }
      };
      
      // Attempt registration with retries
      const registerData = await registerUser();
      
      // Check if registration failed with database error
      if (registerData && !registerData.success && registerData.error) {
        console.log("Registration failed:", registerData.error);
        // Don't proceed to login if registration failed
        return;
      }

      // If registration successful, sign in the user
      console.log("Registration successful, attempting to sign in");
      
      // Implement retry logic for login as well
      const attemptLogin = async (retryCount = 0, maxRetries = 2) => {
        try {
          const signInResult = await signIn('credentials', {
            redirect: false,
            email,
            password,
          });
          
          console.log("Sign in result:", signInResult);
          
          if (signInResult?.error) {
            if (signInResult.error.includes("Database connection") && retryCount < maxRetries) {
              // Wait and retry with exponential backoff
              const waitTime = 1000 * Math.pow(2, retryCount);
              toast({
                title: "Login Connection Issue",
                description: `Retrying login in ${waitTime/1000} seconds...`,
              });
              
              await new Promise(r => setTimeout(r, waitTime));
              return attemptLogin(retryCount + 1, maxRetries);
            }
            
            toast({
              title: "Login Error",
              description: 'Login after registration failed: ' + signInResult.error,
              variant: "destructive",
            });
            return { success: false, error: signInResult.error };
          }
          
          return { success: true };
        } catch (error) {
          if (retryCount < maxRetries) {
            console.log(`Login attempt ${retryCount + 1} failed, retrying...`);
            const waitTime = 1000 * Math.pow(2, retryCount);
            await new Promise(r => setTimeout(r, waitTime));
            return attemptLogin(retryCount + 1, maxRetries);
          }
          
          throw error;
        }
      };
      
      const loginResult = await attemptLogin();
      
      if (loginResult.success) {
        toast({
          title: "Account created",
          description: "Your account has been created successfully and you are now logged in.",
        });
        
        onClose();
        router.refresh();
      } else {
        toast({
          title: "Account created",
          description: "Your account has been created successfully, but we couldn't log you in automatically. Please log in manually.",
          action: (
            <Button 
              variant="outline" 
              onClick={() => {
                onClose();
                const event = new CustomEvent('openLoginModal');
                window.dispatchEvent(event);
              }}
              className="bg-white hover:bg-gray-100 text-gray-800"
            >
              Log In
            </Button>
          ),
        });
      }
    } catch (error: any) {
      console.error("Signup error details:", error);
      // If not handled by specific error messages above
      if (!error.message.includes("already exists") && 
          !error.message.includes("Database connection")) {
        toast({
          title: "Sign Up Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleLoginClick = () => {
    onClose()
    const event = new CustomEvent('openLoginModal')
    window.dispatchEvent(event)
  }

  const formatName = (name: string) => {
    // Remove any non-alphabetic characters
    const cleanName = name.replace(/[^a-zA-Z]/g, '')
    // Capitalize first letter and make rest lowercase
    return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase()
  }

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedName = formatName(e.target.value)
    setFirstName(formattedName)
  }

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedName = formatName(e.target.value)
    setLastName(formattedName)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create an account</DialogTitle>
            <DialogDescription>Enter your details to create a new account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input 
                    id="firstName" 
                    value={firstName} 
                    onChange={handleFirstNameChange}
                    onFocus={() => handleFocusChange('firstName')}
                    pattern="[A-Za-z]+"
                    title="Please enter only alphabetic characters"
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    value={lastName} 
                    onChange={handleLastNameChange}
                    onFocus={() => handleFocusChange('lastName')}
                    pattern="[A-Za-z]+"
                    title="Please enter only alphabetic characters"
                    required 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => handleFocusChange('email')}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onFocus={() => handleFocusChange('password')}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => handleFocusChange('confirmPassword')}
                  required
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="terms" 
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  />
                  <Label htmlFor="terms" className="text-sm flex items-center">
                    I agree to the{' '}
                    <Button 
                      variant="link" 
                      className="h-auto p-0 ml-1 text-primary"
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                    >
                      Terms & Conditions
                    </Button>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="policy" 
                    checked={policyAccepted}
                    onCheckedChange={(checked) => setPolicyAccepted(checked as boolean)}
                  />
                  <Label htmlFor="policy" className="text-sm flex items-center">
                    I agree to the{' '}
                    <Button 
                      variant="link" 
                      className="h-auto p-0 ml-1 text-primary"
                      type="button" 
                      onClick={() => setShowPolicyModal(true)}
                    >
                      Privacy Policy
                    </Button>
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
              <Button variant="outline" type="button" onClick={handleLoginClick}>
                Login here
              </Button>
              <Button type="submit" disabled={isLoading || !termsAccepted || !policyAccepted || showPasswordError}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing up...
                  </>
                ) : (
                  "Sign Up"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showTermsModal && (
        <TermsPolicyModal
          isOpen={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          type="terms"
        />
      )}

      {showPolicyModal && (
        <TermsPolicyModal
          isOpen={showPolicyModal}
          onClose={() => setShowPolicyModal(false)}
          type="policy"
        />
      )}
    </>
  )
}
