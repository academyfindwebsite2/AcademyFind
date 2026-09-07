import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as dateFnsFormat } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIST(dateInput: string | Date, formatStr: string = "PPP 'at' p") {
  // Convert the input to a Date object
  const date = new Date(dateInput);

  // Format the date strictly in Asia/Kolkata timezone using Intl.DateTimeFormat
  // Since date-fns inherently uses the system's local timezone (which is often UTC on servers like Vercel),
  // we shift the UTC time to IST manually to ensure date-fns formats it as if the system was in IST.

  // Get the UTC time in milliseconds
  const utcTime = date.getTime();

  // Create a formatter that gives us the exact date and time parts in IST
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });

  // Format to a string like "MM/DD/YYYY, HH:MM:SS"
  const istDateString = formatter.format(date);

  // Parse that string back into a Date object (this tells the system "treat this IST time as local")
  const localIstDate = new Date(istDateString);

  // Now pass this "shifted" date to date-fns
  return dateFnsFormat(localIstDate, formatStr);
}

export function calculateReadingTime(html: string): number {
  if (!html) return 1;
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).length;
  const readingTime = Math.ceil(words / 200);
  return readingTime > 0 ? readingTime : 1;
}

export function generateInstituteWhatsAppMessage(instituteName: string, instituteSlug?: string | null, instituteId?: string | null): string {
  const profileLink = (instituteSlug && instituteId)
    ? `https://www.academyfind.com/institute/${instituteId}-${instituteSlug}`
    : `https://www.academyfind.com/`;

  return `

Hello ${instituteName}

Greetings from AcademyFind!

We’re pleased to let you know that ${instituteName} is now listed on AcademyFind — a platform that helps students discover, compare and connect with coaching institutes, tutors and learning centres before making an informed decision.

By claiming your profile, you can:

\uD83D\uDD0D Reach students actively searching for relevant courses
\uD83D\uDCE9 Receive real-time student enquiries and leads
\u2B50 Build credibility through student reviews and ratings
\uD83D\uDC68\u200D\uD83C\uDFEB Showcase your faculty, courses, photos, videos & achievements
\uD83D\uDCC8 Strengthen your online presence and attract more students

Today, students don't simply choose an institute based on advertisements. They research, compare, read reviews and seek feedback before joining. AcademyFind helps put ${instituteName} in that decision-making journey.

You can start with a free profile, while our paid plans offer additional features, visibility and lead-generation benefits.

\uD83D\uDC49 Claim your AcademyFind profile:
${profileLink}

For more information, simply reply to this message and our team will be happy to assist you.

Team AcademyFind
\uD83C\uDF10 www.academyfind.com
\uD83D\uDCDE 9045699938

AcademyFind — Discover. Compare. Connect.`;
}

export function formatWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, "");
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");
  // If exactly 10 digits remain, assume it's an Indian number and prepend 91
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
}

export function formatNotificationTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatNotificationRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(date);
}
