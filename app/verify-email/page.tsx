"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const email = searchParams.get("email");
  const otp = searchParams.get("otp");
  const type = searchParams.get("type");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (type === "forget-password" && email) {
      const targetOtp = otp ? `&otp=${encodeURIComponent(otp)}` : "";
      router.replace(`/forgot-password?email=${encodeURIComponent(email)}${targetOtp}`);
      return;
    }

    if (!email || !otp) {
      setStatus("error");
      setMessage("Invalid or missing verification link parameters.");
      return;
    }

    const verify = async () => {
      try {
        const { error } = await authClient.emailOtp.verifyEmail({
          email,
          otp,
        });

        if (error) {
          setStatus("error");
          setMessage(error.message || "Invalid or expired verification code.");
        } else {
          setStatus("success");
          setMessage("Email verified successfully! Logging you in...");
          
          let loggedIn = false;
          if (typeof window !== "undefined") {
            const tempEmail = localStorage.getItem("temp_reg_email");
            const tempPassword = localStorage.getItem("temp_reg_password");
            
            if (tempEmail === email && tempPassword) {
              const { error: loginError } = await authClient.signIn.email({
                email: tempEmail,
                password: tempPassword,
              });
              
              if (!loginError) {
                loggedIn = true;
                localStorage.removeItem("temp_reg_email");
                localStorage.removeItem("temp_reg_password");
                router.push("/");
              }
            }
          }
          
          // Redirect to login if auto-login didn't happen
          if (!loggedIn) {
            setTimeout(() => {
              router.push("/login");
            }, 2000);
          }
        }
      } catch (err) {
        setStatus("error");
        setMessage("Something went wrong during verification.");
      }
    };

    verify();
  }, [email, otp, router]);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-amber-500/30 overflow-hidden">
        <Image src="/logo.png" alt="AcademyFind Logo" width={80} height={80} className="w-16 h-16 object-cover" />
      </div>
      
      {status === "loading" && (
        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">{message}</h2>
          <p className="mt-2 text-slate-500">Please wait while we verify your email.</p>
        </div>
      )}

      {status === "success" && (
        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">{message}</h2>
          <p className="mt-2 text-slate-500">Redirecting you to login page...</p>
          <Link href="/login" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-amber-400 px-8 font-semibold text-white shadow-md transition-all hover:bg-amber-500">
            Go to Login
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
          <XCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">Verification Failed</h2>
          <p className="mt-2 text-slate-500">{message}</p>
          <Link href="/register" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-amber-400 px-8 font-semibold text-white shadow-md transition-all hover:bg-amber-500">
            Back to Register
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-[32px] shadow-2xl">
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-amber-500"/></div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  );
}
