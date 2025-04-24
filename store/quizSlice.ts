import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface QuizState {
  data: {
    title: string
    questions: Array<{
      question: string
      options: string[]
      correctAnswer: string
    }>
  } | null
}

const initialState: QuizState = {
  data: null
}

export const quizSlice = createSlice({
  name: 'quiz',
  initialState,
  reducers: {
    setQuizData: (state, action: PayloadAction<QuizState['data']>) => {
      state.data = action.payload
    },
    clearQuizData: (state) => {
      state.data = null
    }
  }
})

export const { setQuizData, clearQuizData } = quizSlice.actions
export default quizSlice.reducer 