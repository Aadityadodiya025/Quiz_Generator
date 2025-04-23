'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!name || !email || !password || !confirmPassword) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (!acceptTerms || !acceptPolicy) {
      toast({
        title: 'Error',
        description: 'Please accept the terms and policy',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting to register user...');
      
      // Register the user with timeout
      const registerPromise = fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });
      
      // Set a timeout for the registration request
      const registerResponse = await Promise.race([
        registerPromise,
        new Promise<Response>((_, reject) => 
          setTimeout(() => reject(new Error('Registration request timed out')), 10000)
        )
      ]) as Response;

      const registerData = await registerResponse.json();
      console.log('Registration response:', registerData);

      if (!registerResponse.ok) {
        // Handle connection errors more gracefully
        if (registerResponse.status === 503) {
          throw new Error('Database connection error. Please try again later.');
        }
        throw new Error(registerData.message || 'Registration failed');
      }

      // If registration successful, sign in the user
      console.log('Registration successful, attempting to sign in...');
      
      // Sign in with timeout
      const signInPromise = signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      const signInResult = await Promise.race([
        signInPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign in request timed out')), 10000)
        )
      ]);

      console.log('Sign in result:', signInResult);

      if (signInResult?.error) {
        // If sign in fails but registration was successful, let the user know
        // so they can try logging in manually
        toast({
          title: 'Partial Success',
          description: 'Account created, but automatic login failed. Please try logging in manually.',
          variant: 'default',
        });
        
        // Redirect to login page after short delay
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }

      toast({
        title: 'Success',
        description: 'Account created successfully',
      });

      // Add a slight delay before redirect to ensure the toast is seen
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1000);
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Customize messages for different error types
      let errorMessage = error.message || 'Failed to sign up';
      
      if (errorMessage.includes('timed out')) {
        errorMessage = 'The request took too long to complete. Please try again.';
      } else if (errorMessage.includes('database') || errorMessage.includes('MongoDB')) {
        errorMessage = 'Database connection issue. Please try again later.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-14rem)] py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Enter your information to create an account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the{' '}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms & Conditions
                  </Link>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="policy" 
                  checked={acceptPolicy}
                  onCheckedChange={(checked) => setAcceptPolicy(checked as boolean)}
                />
                <Label htmlFor="policy" className="text-sm">
                  I agree to the{' '}
                  <Link href="/policy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || !acceptTerms || !acceptPolicy}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 