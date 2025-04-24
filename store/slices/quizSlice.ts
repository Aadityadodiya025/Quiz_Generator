import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface QuizState {
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<number, string>;
  score: number;
  title: string;
  isCompleted: boolean;
  data: any; // To store raw quiz data
}

const initialState: QuizState = {
  questions: [],
  currentQuestionIndex: 0,
  answers: {},
  score: 0,
  title: '',
  isCompleted: false,
  data: null,
};

export const quizSlice = createSlice({
  name: 'quiz',
  initialState,
  reducers: {
    setQuestions: (state, action: PayloadAction<{ questions: Question[], title: string }>) => {
      state.questions = action.payload.questions;
      state.title = action.payload.title;
      state.currentQuestionIndex = 0;
      state.answers = {};
      state.score = 0;
      state.isCompleted = false;
    },
    setQuizData: (state, action: PayloadAction<any>) => {
      // Validate the quiz data before storing it
      if (!action.payload) {
        console.warn("Attempted to set null or undefined quiz data");
        return;
      }
      
      if (typeof action.payload !== 'object' || Object.keys(action.payload).length === 0) {
        console.warn("Attempted to set empty quiz data object");
        return;
      }
      
      // Store the raw quiz data
      state.data = action.payload;
      
      // Also update the normalized quiz data if possible
      if (action.payload?.questions && Array.isArray(action.payload.questions) && action.payload.questions.length > 0) {
        console.log("Updating quiz questions from provided data");
        state.questions = action.payload.questions;
        state.title = action.payload.title || '';
        state.currentQuestionIndex = 0;
        state.answers = {};
        state.score = 0;
        state.isCompleted = false;
      } else {
        console.warn("Quiz data doesn't contain valid questions array", action.payload);
      }
    },
    setAnswer: (state, action: PayloadAction<{ questionId: number, answer: string }>) => {
      state.answers[action.payload.questionId] = action.payload.answer;
    },
    nextQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
      }
    },
    prevQuestion: (state) => {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
      }
    },
    calculateScore: (state) => {
      let score = 0;
      Object.entries(state.answers).forEach(([questionId, answer]) => {
        const question = state.questions.find(q => q.id === Number(questionId));
        if (question && question.correctAnswer === answer) {
          score += 1;
        }
      });
      state.score = score;
      state.isCompleted = true;
    },
    resetQuiz: (state) => {
      state.currentQuestionIndex = 0;
      state.answers = {};
      state.score = 0;
      state.isCompleted = false;
    },
  },
});

export const { 
  setQuestions, 
  setQuizData,
  setAnswer, 
  nextQuestion, 
  prevQuestion, 
  calculateScore,
  resetQuiz
} = quizSlice.actions;

export const selectQuestions = (state: RootState) => state.quiz.questions;
export const selectCurrentQuestion = (state: RootState) => 
  state.quiz.questions[state.quiz.currentQuestionIndex];
export const selectCurrentQuestionIndex = (state: RootState) => 
  state.quiz.currentQuestionIndex;
export const selectAnswers = (state: RootState) => state.quiz.answers;
export const selectScore = (state: RootState) => state.quiz.score;
export const selectTitle = (state: RootState) => state.quiz.title;
export const selectIsCompleted = (state: RootState) => state.quiz.isCompleted;
export const selectQuizState = (state: RootState) => state.quiz;
export const selectQuizData = (state: RootState) => state.quiz.data;

export default quizSlice.reducer; 