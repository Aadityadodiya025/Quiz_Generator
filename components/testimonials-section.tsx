import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"

export function TestimonialsSection() {
  const testimonials = [
    {
      name: "Harshil Barot",
      role: "Medical Student",
      content:
        "QuizGen has revolutionized how I study for my medical exams. I upload my lecture notes and instantly get quizzes that help me retain information better.",
      avatar: "HB",
      rating: 5,
    },
    {
      name: "Aaditya Dodiya",
      role: "Language Teacher",
      content:
        "As a teacher, I use QuizGen to create assessments for my students. It saves me hours of work and generates questions I wouldn't have thought of myself.",
      avatar: "AD",
      rating: 4.5,
    },
    {
      name: "Harsh Grak",
      role: "Law Student",
      content:
        "Studying case law is challenging, but QuizGen helps me extract the key concepts and test my understanding. It's become an essential part of my study routine.",
      avatar: "HG",
      rating: 4,
    },
  ]

  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className="h-4 w-4 fill-yellow-400 text-yellow-400"
        />
      )
    }

    if (hasHalfStar) {
      stars.push(
        <Star
          key="half"
          className="h-4 w-4 fill-yellow-400/50 text-yellow-400"
        />
      )
    }

    const emptyStars = 5 - stars.length
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star
          key={`empty-${i}`}
          className="h-4 w-4 text-yellow-400/30"
        />
      )
    }

    return stars
  }

  return (
    <div className="container py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight">What Our Users Say</h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          Hear from students and educators who are using QuizGen to enhance their learning experience
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {testimonials.map((testimonial, index) => (
          <Card
            key={index}
            className="group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg dark:hover:shadow-primary/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 group-hover:opacity-100 opacity-0 transition-opacity duration-300" />
            <CardHeader className="relative">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {testimonial.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="group-hover:text-primary transition-colors duration-300">
                    {testimonial.name}
                  </CardTitle>
                  <CardDescription className="group-hover:text-foreground transition-colors duration-300">
                    {testimonial.role}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                {renderStars(testimonial.rating)}
                <span className="text-sm text-muted-foreground ml-2">
                  {testimonial.rating.toFixed(1)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                {testimonial.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
