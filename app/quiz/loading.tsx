import { Loading } from "@/components/ui/loading"

export default function QuizLoading() {
  return (
    <div className="container py-12 flex justify-center">
      <Loading size="lg" text="Starting your quiz..." />
    </div>
  )
} 