import { Metadata } from "next";
import { Suspense } from "react";
import ForgotPasswordComponent from "./ForgotPassword";
import { getPlatformStats } from "@/lib/stats";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Forgot Password | AcademyFind",
  description: "Reset your AcademyFind account password.",
  alternates: {
    canonical: "https://academyfind.com/forgot-password",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default async function ForgotPasswordPage() {
  const stats = await getPlatformStats();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <ForgotPasswordComponent stats={stats} />
    </Suspense>
  );
}

