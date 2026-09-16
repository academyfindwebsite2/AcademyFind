"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2, // 👈 Loading spinner ke liye add kiya hai
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import Image from "next/image";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import toast from 'react-hot-toast'
import { useMobileApp } from "@/hooks/useMobileApp";
import { getAuthRedirectTarget } from "@/lib/auth/redirect-utils";

export default function RegisterComponent() { // Component ka naam RegisterPage hona better hai
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { isMobileApp } = useMobileApp();

  // User Details States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setphone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 🚀 Nayi States for frictionless flow
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = getAuthRedirectTarget(searchParams);

  useEffect(() => {
    authClient.getSession().then((res) => {
      if (res.data?.user) {
        router.replace(redirectTarget);
      }
    });
  }, [router, redirectTarget]);

  const handleGoogleLogin = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTarget,
    });
  };
  // 1. Account Create & Send OTP
  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (method !== "email") {
      toast.error("Phone registration will be implemented separately.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter both name and email");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Step A: Account Create Karein
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
        phone,
      });

      if (signUpError) {
        toast.error("Registration failed");
        setIsLoading(false);
        return;
      }

      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
        email: email,
        type: "email-verification",
      });

      if (otpError) {
        toast.error("Account created, but OTP sending failed ");
      } else {
        // Step C: UI change karke OTP screen dikhayein (No Redirect)
        setShowOtpScreen(true);
        // Store temporarily for auto-login if they verify via link in the same browser
        if (typeof window !== "undefined") {
          localStorage.setItem("temp_reg_email", email);
          localStorage.setItem("temp_reg_password", password);
        }
        toast.success("OTP Sent your mail, Please verify")
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // 2. Verify OTP & Auto-Login
  async function handleVerifyAndLogin(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return;

    setIsLoading(true);

    try {
      // Step A: Verify OTP
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });

      if (verifyError) {
        toast.error("Invalid OTP, please enter correct one");
        setOtp("")
        setIsLoading(false);
        return;
      }

      // Step B: Auto Login using state password
      const { error: loginError } = await authClient.signIn.email({
        email,
        password,
      });

      if (loginError) {
        toast.error("Email verified, but auto-login failed. Please login manually.");
        const loginUrl =
          redirectTarget && redirectTarget !== "/"
            ? `/login?callbackUrl=${encodeURIComponent(redirectTarget)}`
            : "/login";
        router.push(loginUrl);
      } else {
        // Step C: Makkhan redirect to previous page
        if (typeof window !== "undefined") {
          localStorage.removeItem("temp_reg_email");
          localStorage.removeItem("temp_reg_password");
        }
        router.push(redirectTarget);
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong during verification.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-4 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[32px] bg-white shadow-2xl">

        {/* LEFT PANEL */}
        <div className="relative hidden w-1/2 overflow-hidden bg-linear-to-b from-amber-400 to-orange-500 p-12 text-white lg:flex lg:flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 backdrop-blur">
              <Image src="/logo.png" alt="academy find logo" width={120} height={120} />
            </div>
            <span className="font-semibold">AcademyFind</span>
          </div>

          {/* Content */}
          <div className="mt-20">
            <h1 className="max-w-md text-5xl font-bold leading-tight">
              Start Your Learning Journey With Confidence
            </h1>
            <p className="mt-5 max-w-sm text-orange-100">
              Join thousands of students discovering the best coaching institutes across India.
            </p>

            {/* Journey Steps */}
            <div className="mt-12 space-y-4">
              {[
                { title: "Search Institutes", desc: "Explore coaching institutes across India" },
                { title: "Compare Options", desc: "Check ratings, reviews and facilities" },
                { title: "Connect Directly", desc: "Reach institutes without middlemen" },
                { title: "Choose Confidently", desc: "Make better academic decisions" },
              ].map((step, index) => (
                <div key={step.title} className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-orange-500">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-orange-100">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative Circles */}
          <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-1 items-center justify-center bg-[#fafafa] px-6 py-10">
          <div className="w-full max-w-md">

            {/* Logo Mobile */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg shadow-amber-500/30">
                <Image src="/logo.png" alt="AcademyFind Logo" width={120} height={120} />
              </div>
              <h3 className="text-sm font-bold tracking-[0.25em] text-slate-900">ACADEMYFIND</h3>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-400">
                Academy Search Simplified
              </p>
            </div>

            {/* 🔥 CONDITIONAL RENDERING STARTS HERE */}
            {showOtpScreen ? (

              /* ================= OTP VERIFICATION UI ================= */
              <div className="animate-in fade-in zoom-in duration-300">
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-bold bg-linear-to-r from-amber-500 to-rose-200 bg-clip-text text-transparent">
                    Check Your Email
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    We've sent a 6-digit verification code to <br /> <strong className="text-slate-800">{email}</strong>
                  </p>
                </div>

                <form onSubmit={handleVerifyAndLogin} className="space-y-6">
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-2xl font-semibold tracking-[0.5em] outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otp.length < 6}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                      </>
                    ) : (
                      "Verify & Login"
                    )}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Made a mistake?{" "}
                  <button
                    onClick={() => setShowOtpScreen(false)}
                    className="font-semibold text-amber-400 hover:text-amber-500"
                  >
                    Change Email
                  </button>
                </p>
              </div>

            ) : (

              /* ================= ORIGINAL REGISTRATION UI ================= */
              <div className="animate-in fade-in duration-300">

                <div className="mb-6 text-center">
                  <h2 className="text-3xl font-bold bg-linear-to-r from-amber-500 to-rose-200 bg-clip-text text-transparent">
                    Create Account
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Join AcademyFind and discover India's best coaching institutes.
                  </p>
                </div>

                {/* <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMethod("email")}
                    className={`flex items-center justify-center gap-2 cursor-pointer rounded-lg py-2 text-sm font-medium transition-all ${
                      method === "email" ? "bg-amber-400 text-white shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <Mail size={16} /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("phone")}
                    className={`flex items-center justify-center gap-2 cursor-pointer rounded-lg py-2 text-sm font-medium transition-all ${
                      method === "phone" ? "bg-amber-400 text-white shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <Phone size={16} /> Phone
                  </button>
                </div> */}

                <form className="space-y-5" onSubmit={handleRegister}>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Enter your full name"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Mobile No. </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-slate-500 font-medium text-sm pointer-events-none">+91</span>
                      <input
                        type="tel"
                        placeholder="Enter your mobile No."
                        maxLength={10}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={phone}
                        onChange={(e) => setphone(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {method === "email" ? "Email Address" : "Phone Number"}
                      <span className="text-red-500"> *</span>
                    </label>
                    <div className="relative">
                      {method === "email" ? (
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      ) : (
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      )}
                      <input
                        type={method === "email" ? "email" : "tel"}
                        placeholder={method === "email" ? "Enter your email" : "Enter mobile number"}
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={method === "email" ? email : phone}
                        onChange={(e) => {
                          if (method === "email") setEmail(e.target.value);
                          else setphone(e.target.value);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-12 w-full items-center justify-center gap-2 cursor-pointer rounded-xl bg-amber-400 font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </button>
                </form>

                {!isMobileApp && (
                  <>
                    <div className="my-6 flex items-center">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="mx-4 text-xs text-slate-400">OR</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <button
                      type="button"
                      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={handleGoogleLogin}
                    >
                      <FcGoogle size={20} /> Continue with Google
                    </button>
                  </>
                )}

                <p className="mt-8 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link
                    href={
                      redirectTarget && redirectTarget !== "/"
                        ? `/login?callbackUrl=${encodeURIComponent(redirectTarget)}`
                        : "/login"
                    }
                    className="font-semibold text-amber-400 hover:text-amber-500"
                  >
                    Sign In
                  </Link>
                </p>

                {/* Institute Owner CTA */}
                <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-100 p-5 text-center transition-all shadow-sm hover:bg-amber-100/50">
                  <p className="text-sm font-bold text-slate-800">Are you an Institute Owner?</p>
                  <p className="text-xs text-slate-500 mt-1.5 mb-4">List your institute on AcademyFind to reach thousands of students in your city.</p>
                  <Link href="/user/create-institute" className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-amber-500 hover:shadow-md hover:shadow-amber-500/20 w-full">
                    Join AcademyFind
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}