import type React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface TermsPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  type: "terms" | "policy"
}

export function TermsPolicyModal({ isOpen, onClose, type }: TermsPolicyModalProps) {
  const content = {
    terms: {
      title: "Terms & Conditions",
      sections: [
        {
          title: "1. Acceptance of Terms",
          content: "By accessing and using QuizGen, you accept and agree to be bound by the terms and provision of this agreement."
        },
        {
          title: "2. Use License",
          content: "Permission is granted to temporarily use QuizGen for personal, non-commercial transitory viewing only."
        },
        {
          title: "3. User Responsibilities",
          content: "Users are responsible for maintaining the confidentiality of their account information and for all activities that occur under their account."
        },
        {
          title: "4. Content Guidelines",
          content: "Users must ensure that all content uploaded for quiz generation complies with applicable laws and does not infringe on any third-party rights."
        },
        {
          title: "5. Limitation of Liability",
          content: "QuizGen shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service."
        }
      ]
    },
    policy: {
      title: "Privacy Policy",
      sections: [
        {
          title: "1. Information We Collect",
          content: "We collect information that you provide directly to us, including account information, quiz content, and usage data."
        },
        {
          title: "2. How We Use Your Information",
          content: "We use the collected information to provide and improve our services, personalize your experience, and communicate with you."
        },
        {
          title: "3. Data Security",
          content: "We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or disclosure."
        },
        {
          title: "4. Cookies and Tracking",
          content: "We use cookies and similar tracking technologies to track activity on our service and hold certain information."
        },
        {
          title: "5. Your Rights",
          content: "You have the right to access, correct, or delete your personal information. You can also opt-out of certain data collection practices."
        }
      ]
    }
  }

  const currentContent = content[type]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{currentContent.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {currentContent.sections.map((section, index) => (
              <div key={index} className="space-y-2">
                <h3 className="text-lg font-semibold">{section.title}</h3>
                <p className="text-muted-foreground">{section.content}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 