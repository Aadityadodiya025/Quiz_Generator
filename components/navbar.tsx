"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { LoginModal } from "@/components/login-modal"
import { SignupModal } from "@/components/signup-modal"
import { useAuth } from "@/components/auth-provider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileText, Home, LogIn, LogOut, Menu, PieChart, User, X, VideoIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const { theme } = useTheme()
  const { isAuthenticated } = useAuth()
  const { data: session } = useSession()
  const router = useRouter()

  // Add event listeners for custom events
  useEffect(() => {
    const handleOpenLoginModal = () => {
      setIsLoginOpen(true);
    };

    const handleOpenSignupModal = () => {
      setIsSignupOpen(true);
    };

    window.addEventListener("openLoginModal", handleOpenLoginModal);
    window.addEventListener("openSignupModal", handleOpenSignupModal);

    return () => {
      window.removeEventListener("openLoginModal", handleOpenLoginModal);
      window.removeEventListener("openSignupModal", handleOpenSignupModal);
    };
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  const navLinks = [
    { name: "Home", href: "/", icon: <Home className="h-4 w-4 mr-2" /> },
    { name: "Quiz", href: "/upload", icon: <FileText className="h-4 w-4 mr-2" /> },
    { name: "Summary", href: "/summary", icon: <FileText className="h-4 w-4 mr-2" /> },
    { name: "Video Summarizer", href: "/video-summarizer", icon: <VideoIcon className="h-4 w-4 mr-2" /> },
    { name: "Dashboard", href: "/dashboard", icon: <PieChart className="h-4 w-4 mr-2" /> },
  ]

  const handleLogin = () => {
    setIsSignupOpen(false)
    setIsLoginOpen(true)
  }

  const handleSignup = () => {
    setIsLoginOpen(false)
    setIsSignupOpen(true)
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  const handleProfile = () => {
    router.push('/profile')
  }

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-500">
                QuizGen
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Button
                key={link.name}
                variant="ghost"
                onClick={() => handleNavigation(link.href)}
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                {link.name}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ModeToggle />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleProfile}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" onClick={handleLogin}>
                  Login
                </Button>
                <Button onClick={handleSignup}>Sign Up</Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMenu}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t">
            <div className="container py-4 grid gap-4">
              {navLinks.map((link) => (
                <Button
                  key={link.name}
                  variant="ghost"
                  onClick={() => {
                    handleNavigation(link.href)
                    setIsMenuOpen(false)
                  }}
                  className="flex items-center text-sm font-medium transition-colors hover:text-primary"
                >
                  {link.icon}
                  {link.name}
                </Button>
              ))}
              {!isAuthenticated ? (
                <div className="grid gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleLogin()
                      setIsMenuOpen(false)
                    }}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Button>
                  <Button
                    onClick={() => {
                      handleSignup()
                      setIsMenuOpen(false)
                    }}
                  >
                    Sign Up
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleLogout()
                    setIsMenuOpen(false)
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </>
  )
}
