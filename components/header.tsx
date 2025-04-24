import Link from "next/link"

export function Header() {
  return (
    <div className="flex items-center space-x-4">
      <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
        Home
      </Link>
      <Link href="/quiz" className="text-sm font-medium transition-colors hover:text-primary">
        Quiz
      </Link>
      <Link href="/summary" className="text-sm font-medium transition-colors hover:text-primary">
        Summary
      </Link>
      <Link href="/about" className="text-sm font-medium transition-colors hover:text-primary">
        About
      </Link>
      <Link href="/contact" className="text-sm font-medium transition-colors hover:text-primary">
        Contact
      </Link>
    </div>
  )
} 