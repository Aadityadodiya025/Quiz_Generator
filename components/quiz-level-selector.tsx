'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from './ui/use-toast';
import { useRouter } from 'next/navigation';

type QuizLevel = 'easy' | 'normal' | 'hard';

interface LevelOption {
  value: QuizLevel;
  label: string;
  description: string;
  questionCount: number;
}

const levels: LevelOption[] = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Basic questions covering main concepts with straightforward answers',
    questionCount: 5
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Moderate difficulty with more specific questions and detailed answer options',
    questionCount: 10
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'Challenging questions requiring deeper understanding and detailed knowledge',
    questionCount: 15
  }
];

export default function QuizLevelSelector() {
  const [selectedLevel, setSelectedLevel] = useState<QuizLevel>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLevelChange = (level: QuizLevel) => {
    setSelectedLevel(level);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/quiz-level', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ level: selectedLevel }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set quiz level');
      }

      // Save to session storage for accessibility across pages
      sessionStorage.setItem('quizLevel', selectedLevel);
      sessionStorage.setItem('quizLevelDescription', data.description);
      sessionStorage.setItem('quizQuestionCount', data.questionCount.toString());

      toast({
        title: 'Quiz Level Set',
        description: `Difficulty set to ${selectedLevel}. Preparing ${data.questionCount} questions.`,
      });

      // Proceed to the quiz
      router.push('/quiz-preview');
    } catch (error: any) {
      toast({
        title: 'Error Setting Quiz Level',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Select Quiz Difficulty</CardTitle>
        <CardDescription>
          Choose the difficulty level for your quiz
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          value={selectedLevel} 
          onValueChange={(value) => handleLevelChange(value as QuizLevel)}
          className="space-y-4"
        >
          {levels.map((level) => (
            <div key={level.value} className="flex items-start space-x-3 border p-4 rounded-md hover:bg-gray-50 transition-colors">
              <RadioGroupItem 
                value={level.value} 
                id={`level-${level.value}`} 
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex justify-between">
                  <Label 
                    htmlFor={`level-${level.value}`} 
                    className="text-lg font-medium cursor-pointer"
                  >
                    {level.label}
                  </Label>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded-full">
                    {level.questionCount} questions
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{level.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Setting Level...' : 'Start Quiz'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 