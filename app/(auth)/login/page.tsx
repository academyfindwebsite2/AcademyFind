import { Metadata } from "next";
import { Suspense } from "react";
import LoginComponent from "./Login";
import { getPlatformStats } from "@/lib/stats";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Login to AcademyFind | Student & Institute Dashboard",
  description: "Access your AcademyFind account to shortlist top coaching institutes, manage your profile, write reviews, and book strategy calls.",
  alternates: {
    canonical: "https://academyfind.com/login",
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Login | AcademyFind",
    description: "Access your AcademyFind dashboard.",
    url: "https://cademyfind.com/login",
    siteName: "AcademyFind",
    type: "website",
  },
};

export default async function LoginPage() {
  const stats = await getPlatformStats();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <LoginComponent stats={stats} />
    </Suspense>
  );
}
