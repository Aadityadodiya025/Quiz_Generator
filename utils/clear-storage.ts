/**
 * Utility functions to clear browser storage
 */

export function clearSessionStorage(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.clear();
      console.log('Session storage cleared successfully');
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }
  }
}

export function clearYouTubeData(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem('videoSummary');
      window.sessionStorage.removeItem('lastVideoUrl');
      console.log('YouTube data cleared from session storage');
    } catch (error) {
      console.error('Error clearing YouTube data:', error);
    }
  }
}

export function clearQuizData(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem('quizData');
      window.sessionStorage.removeItem('generatedQuiz');
      window.sessionStorage.removeItem('activeQuiz');
      window.sessionStorage.removeItem('quizResults');
      window.sessionStorage.removeItem('completedQuiz');
      console.log('Quiz data cleared from session storage');
    } catch (error) {
      console.error('Error clearing quiz data:', error);
    }
  }
} 