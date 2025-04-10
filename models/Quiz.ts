// models/Quiz.ts
import mongoose from "mongoose"

const QuestionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  answer: String,
})

const QuizSchema = new mongoose.Schema({
  title: String,
  questions: [QuestionSchema],
})

export const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema)
