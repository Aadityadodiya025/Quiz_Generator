import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Mock user storage for development when DB is unavailable
const MOCK_USERS_FILE = path.join(process.cwd(), 'mock-users.json');

// Function to save mock user
async function saveMockUser(userData: any) {
  try {
    let users: any[] = [];
    
    // Load existing mock users if file exists
    if (fs.existsSync(MOCK_USERS_FILE)) {
      const data = fs.readFileSync(MOCK_USERS_FILE, 'utf8');
      users = JSON.parse(data);
    }
    
    // Check if user with this email already exists
    const existingUser = users.find(user => user.email === userData.email);
    if (existingUser) {
      return { success: false, message: 'User already exists' };
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    
    // Create user with ID
    const newUser = {
      _id: `mock_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    // Add to mock users and save file
    users.push(newUser);
    fs.writeFileSync(MOCK_USERS_FILE, JSON.stringify(users, null, 2));
    
    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return { success: true, data: userWithoutPassword };
  } catch (error: any) {
    console.error('Error saving mock user:', error);
    return { success: false, message: error.message };
  }
}

export async function POST(request: NextRequest) {
  console.log('Registration endpoint hit');
  
  try {
    // Parse request body with error handling
    let name, email, password;
    try {
      const body = await request.json();
      ({ name, email, password } = body);
      console.log('Registration data received:', { name, email, passwordLength: password?.length });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid request format' 
      }, { status: 400 });
    }

    // Validate required fields
    if (!name || !email || !password) {
      console.log('Missing required fields');
      return NextResponse.json({ 
        success: false, 
        message: 'Please provide all required fields' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Invalid email format:', email);
      return NextResponse.json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      console.log('Password too short');
      return NextResponse.json({ 
        success: false, 
        message: 'Password must be at least 8 characters long' 
      }, { status: 400 });
    }

    // Try to connect to MongoDB with fallback to mock user registration
    let dbConnected = false;
    try {
      console.log('Attempting to connect to MongoDB...');
      const dbTimeout = parseInt(process.env.API_TIMEOUT || '10000');
      
      await Promise.race([
        dbConnect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timed out')), dbTimeout)
        )
      ]);
      
      console.log('MongoDB connection successful');
      dbConnected = true;
    } catch (dbError: any) {
      console.error('MongoDB connection failed:', dbError);
      
      // If in development mode, use mock user registration
      if (process.env.NODE_ENV === 'development') {
        console.log('Using mock user registration in development mode');
        const mockResult = await saveMockUser({ name, email, password });
        
        if (!mockResult.success) {
          return NextResponse.json({ 
            success: false, 
            message: mockResult.message,
            details: 'Using mock user registration (database unavailable)'
          }, { status: 409 });
        }
        
        return NextResponse.json({
          success: true,
          message: 'User registered successfully (mock)',
          data: mockResult.data,
          mock: true
        }, { status: 201 });
      }
      
      // In production, return error
      return NextResponse.json({ 
        success: false, 
        message: 'Database connection error. Please try again later.', 
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      }, { status: 503 });
    }

    // If we're here, we have a database connection
    if (dbConnected) {
      // Check if user already exists
      let userExists;
      try {
        userExists = await User.findOne({ email }).maxTimeMS(5000);
      } catch (findError: any) {
        console.error('Error checking existing user:', findError);
        return NextResponse.json({ 
          success: false, 
          message: 'Error checking user account. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? findError.message : undefined
        }, { status: 500 });
      }
      
      if (userExists) {
        console.log('User already exists with email:', email);
        return NextResponse.json({ 
          success: false, 
          message: 'User with this email already exists' 
        }, { status: 409 });
      }

      console.log('Creating new user...');
      // Create new user
      try {
        const user = await User.create({
          name,
          email,
          password, // Will be hashed by the pre-save hook
        });
        
        console.log('User created successfully:', user._id);
        
        // Return success response (without password)
        return NextResponse.json({
          success: true,
          message: 'User registered successfully',
          data: {
            id: user._id,
            name: user.name,
            email: user.email,
          }
        }, { status: 201 });
      } catch (createError: any) {
        console.error('Error creating user:', createError);
        
        // Handle MongoDB validation errors
        if (createError.name === 'ValidationError') {
          const fieldErrors = Object.keys(createError.errors).map(field => {
            return `${field}: ${createError.errors[field].message}`;
          });
          
          return NextResponse.json({ 
            success: false, 
            message: 'Validation error',
            details: fieldErrors.join(', ')
          }, { status: 400 });
        }
        
        // Handle MongoDB duplicate key error
        if (createError.code === 11000) {
          return NextResponse.json({ 
            success: false, 
            message: 'User with this email already exists',
          }, { status: 409 });
        }
        
        return NextResponse.json({ 
          success: false, 
          message: 'Registration failed. Please try again.',
          details: process.env.NODE_ENV === 'development' ? createError.message : undefined
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    
    return NextResponse.json({ 
      success: false, 
      message: 'Registration failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
} 