import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    maxlength: [50, 'Name cannot be more than 50 characters'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  quizHistory: [{
    quizId: String,
    title: String,
    score: Number,
    totalQuestions: Number,
    correctAnswers: Number,
    timeTaken: Number,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
  summaryHistory: [{
    title: String,
    originalText: String,
    summary: String,
    wordCount: Number,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
  videoSummaryHistory: [{
    videoId: String,
    title: String,
    url: String,
    summary: String,
    duration: Number,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  try {
    // Only hash the password if it's modified (or new)
    if (!this.isModified('password')) return next();
    
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('Password hashed successfully');
    next();
  } catch (error) {
    console.error('Error hashing password:', error);
    next(error);
  }
});

// Ensure passwords can be compared
UserSchema.methods.matchPassword = async function(enteredPassword: string) {
  try {
    // We need to select the password field since it's excluded by default
    if (!this.password) {
      const user = await this.constructor.findById(this._id).select('+password');
      if (!user || !user.password) {
        throw new Error('Password not available for comparison');
      }
      return await bcrypt.compare(enteredPassword, user.password);
    }
    
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw error;
  }
};

// Export the model if it doesn't exist already
export default mongoose.models.User || mongoose.model('User', UserSchema); 