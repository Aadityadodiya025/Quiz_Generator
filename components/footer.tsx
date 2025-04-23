import Link from "next/link"
import { Instagram, Linkedin, Facebook } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} QuizGen. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-sm font-medium transition-colors hover:text-primary">
            Terms & Conditions
          </Link>
          <Link href="/policy" className="text-sm font-medium transition-colors hover:text-primary">
            Policy
          </Link>
          <div className="w-px h-4 bg-border mx-2"></div>
          <Link 
            href="https://instagram.com" 
            className="text-sm font-medium transition-all hover:text-primary hover:scale-110"
          >
            <Instagram className="h-4 w-4" />
          </Link>
          <Link 
            href="https://linkedin.com" 
            className="text-sm font-medium transition-all hover:text-primary hover:scale-110"
          >
            <Linkedin className="h-4 w-4" />
          </Link>
          <Link 
            href="https://facebook.com" 
            className="text-sm font-medium transition-all hover:text-primary hover:scale-110"
          >
            <Facebook className="h-4 w-4" />
          </Link>
          <Link 
            href="https://twitter.com" 
            className="text-sm font-medium transition-all hover:text-primary hover:scale-110"
          >
            <svg 
              className="h-4 w-4" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  )
}
