import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Mock users file for development when DB is unavailable
const MOCK_USERS_FILE = path.join(process.cwd(), 'mock-users.json');

// Function to check if user exists in mock users
async function verifyMockUser(email: string, password: string) {
  try {
    if (!fs.existsSync(MOCK_USERS_FILE)) {
      return null;
    }
    
    const data = fs.readFileSync(MOCK_USERS_FILE, 'utf8');
    const users = JSON.parse(data);
    
    const user = users.find((u: any) => u.email === email);
    if (!user) {
      return null;
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      id: user._id,
      name: user.name,
      email: user.email
    };
  } catch (error) {
    console.error('Error verifying mock user:', error);
    return null;
  }
}

// Define auth options
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          throw new Error('Missing email or password');
        }

        try {
          // Connect to database with improved error handling
          let dbConnected = false;
          try {
            console.log('Attempting to connect to database...');
            await dbConnect();
            console.log('Database connection successful');
            dbConnected = true;
          } catch (dbError: any) {
            console.error('Database connection error:', dbError);
            
            // In development mode, try mock user authentication
            if (process.env.NODE_ENV === 'development') {
              console.log('Trying mock user authentication...');
              const mockUser = await verifyMockUser(credentials.email, credentials.password);
              
              if (mockUser) {
                console.log('Mock user authentication successful');
                return mockUser;
              }
              
              console.log('Mock user authentication failed');
            }
            
            // More specific error handling based on error type
            if (dbError.name === 'MongoNetworkError' || dbError.message.includes('connect')) {
              throw new Error('Database connection error. Please try again later.');
            } else if (dbError.name === 'MongoServerSelectionError') {
              throw new Error('Database server selection timeout. Please try again later.');
            } else {
              throw new Error(`Database error: ${dbError.message || 'Unknown database error'}`);
            }
          }

          if (dbConnected) {
            // Find user by email with timeout and explicitly select the password field
            console.log('Finding user:', credentials.email);
            const userPromise = User.findOne({ email: credentials.email }).select('+password').maxTimeMS(5000);
            const user = await userPromise;

            if (!user) {
              console.log('No user found with email:', credentials.email);
              throw new Error('No user found with this email');
            }

            console.log('User found, verifying password...');
            // Check if password matches with timeout
            const isPasswordCorrect = await Promise.race([
              bcrypt.compare(credentials.password, user.password),
              new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error('Password verification timed out')), 5000)
              )
            ]) as boolean;

            if (!isPasswordCorrect) {
              console.log('Invalid password for user:', credentials.email);
              throw new Error('Invalid password');
            }

            console.log('Login successful for user:', user.email);
            return {
              id: user._id.toString(),
              name: user.name,
              email: user.email,
            };
          }
          
          throw new Error('Authentication failed');
        } catch (error: any) {
          console.error('Authentication error:', error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}; 