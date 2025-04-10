import Link from "next/link"
import { Github, Twitter } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} QuizGen. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="#" className="text-sm font-medium transition-colors hover:text-primary">
            Terms
          </Link>
          <Link href="#" className="text-sm font-medium transition-colors hover:text-primary">
            Privacy
          </Link>
          <Link href="https://github.com" className="text-sm font-medium transition-colors hover:text-primary">
            <Github className="h-4 w-4" />
          </Link>
          <Link href="https://twitter.com" className="text-sm font-medium transition-colors hover:text-primary">
            <Twitter className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </footer>
  )
}
