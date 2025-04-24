import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile | QuizGen",
  description: "Manage your QuizGen profile and account settings",
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="min-h-screen bg-background">
      {children}
    </section>
  )
} 