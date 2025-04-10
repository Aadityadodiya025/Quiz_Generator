// lib/mongodb.ts
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/quizdb"

let cached = (global as any).mongoose || { conn: null, promise: null }

export async function connectToDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    })
  }
  cached.conn = await cached.promise
  return cached.conn
}
