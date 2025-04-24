import { Loading } from "@/components/ui/loading"

export default function QuizPreviewLoading() {
  return (
    <div className="container py-12 flex justify-center">
      <Loading size="lg" text="Preparing quiz preview..." />
    </div>
  )
} 