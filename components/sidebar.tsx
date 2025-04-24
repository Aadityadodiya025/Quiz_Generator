import {
  LayoutGrid,
  LibraryBig,
  FileText,
  Settings,
  User,
  FileQuestion,
  Home,
  LogOut,
  Video,
  FileIcon
} from "lucide-react"

export const navigationLinks = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "File Upload",
    label: "Quiz",
    href: "/file-upload",
    icon: FileText,
  },
  {
    title: "Video Summarizer",
    href: "/video-summarizer",
    icon: Video,
  },
  {
    title: "PDF Summarizer",
    href: "/pdf-summarizer",
    icon: FileIcon,
  },
  {
    title: "My Quizzes",
    href: "/quizzes",
    icon: FileQuestion,
  },
] 