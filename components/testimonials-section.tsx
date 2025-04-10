import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function TestimonialsSection() {
  const testimonials = [
    {
      name: "Alex Johnson",
      role: "Medical Student",
      content:
        "QuizGen has revolutionized how I study for my medical exams. I upload my lecture notes and instantly get quizzes that help me retain information better.",
      avatar: "AJ",
    },
    {
      name: "Sarah Chen",
      role: "Language Teacher",
      content:
        "As a teacher, I use QuizGen to create assessments for my students. It saves me hours of work and generates questions I wouldn't have thought of myself.",
      avatar: "SC",
    },
    {
      name: "Michael Rodriguez",
      role: "Law Student",
      content:
        "Studying case law is challenging, but QuizGen helps me extract the key concepts and test my understanding. It's become an essential part of my study routine.",
      avatar: "MR",
    },
  ]

  return (
    <div className="container py-16 bg-slate-50 dark:bg-slate-900/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight">What Our Users Say</h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          Join thousands of students and educators who are transforming how they learn and teach
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {testimonials.map((testimonial, index) => (
          <Card key={index} className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar>
                <AvatarFallback>{testimonial.avatar}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                <CardDescription>{testimonial.role}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{testimonial.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
