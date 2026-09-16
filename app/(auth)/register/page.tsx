import { Suspense } from "react";
import RegisterComponent from "./Register";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Create an Account | Join AcademyFind Today",
  description: "Join AcademyFind to discover, compare, and connect with India's best coaching institutes, schools, and hostels. Sign up for free today.",
  alternates: {
    canonical: "https://academyfind.com/register",
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Sign Up for AcademyFind",
    description: "Create your free account to find the best educational institutes in India.",
    url: "https://cademyfind.com/register",
    siteName: "AcademyFind",
    type: "website",
  },
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <RegisterComponent />
    </Suspense>
  );
}