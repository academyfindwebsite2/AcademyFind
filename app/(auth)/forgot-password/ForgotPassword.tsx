"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Star,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { PlatformStats } from "@/lib/stats";

export default function ForgotPasswordComponent({ stats }: { stats?: PlatformStats }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Read email & otp from query parameters (e.g. from email link)
  useEffect(() => {
    const queryEmail = searchParams.get("email");
    const queryOtp = searchParams.get("otp");

    if (queryEmail) {
      setEmail(queryEmail);
    }

    if (queryOtp) {
      const cleanOtp = queryOtp.replace(/\D/g, "");
      setOtp(cleanOtp);
      if (cleanOtp.length === 6 && queryEmail) {
        setStep("otp");
      }
    }
  }, [searchParams]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email: cleanEmail,
      });

      if (error) {
        toast.error(error.message || "Failed to send reset code.");
      } else {
        toast.success("Password reset code sent to your email!");
        setStep("otp");
        setCooldown(60); // 60s cooldown
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || isLoading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Email is required to resend code.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email: cleanEmail,
      });

      if (error) {
        toast.error(error.message || "Failed to resend code.");
      } else {
        toast.success("A new 6-digit code has been sent!");
        setCooldown(60);
      }
    } catch {
      toast.error("Failed to resend verification code.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (cleanOtp.length < 6) {
      toast.error("Please enter a valid 6-digit code.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await authClient.emailOtp.resetPassword({
        email: cleanEmail,
        otp: cleanOtp,
        password,
      });

      if (error) {
        toast.error(error.message || "Failed to reset password.");
      } else {
        toast.success("Password reset successfully! Redirecting to login...", {
          duration: 3000,
        });
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
        {/* LEFT BRAND PANEL */}
        <div className="relative hidden w-1/2 overflow-hidden bg-linear-to-b from-amber-400 to-amber-500 p-12 text-white lg:flex lg:flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-amber-500/30 bg-white/90 backdrop-blur">
              <Image src="/logo.png" alt="AcademyFind Logo" width={120} height={120} />
            </div>
            <span className="font-semibold">
              AcademyFind
              <p className="text-[0.6rem] text-amber-100">Academy Search Simplified</p>
            </span>
          </div>

          {/* Content */}
          <div className="mt-24 max-w-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-white" /> Account Security
            </div>
            <h1 className="mt-4 text-5xl font-bold leading-tight">
              Reset Your Password
            </h1>
            <p className="mt-5 text-orange-100 text-sm leading-relaxed">
              Regain access to compare coaching institutes, consult verified student reviews, and unlock exclusive educational scholarships.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-14 flex flex-wrap gap-4">
            <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur-md border border-white/10">
              <p className="text-2xl font-bold">
                {stats?.instituteCount !== undefined
                  ? `${stats.instituteCount.toLocaleString("en-IN")}+`
                  : "41,000+"}
              </p>
              <p className="text-xs text-orange-100">Institutes</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur-md border border-white/10">
              <p className="text-2xl font-bold">
                {stats?.cityCount !== undefined
                  ? `${stats.cityCount.toLocaleString("en-IN")}+`
                  : "9+"}
              </p>
              <p className="text-xs text-orange-100">Cities</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-white text-white" />
                <span className="text-2xl font-bold">
                  {stats?.avgRating !== undefined ? stats.avgRating.toFixed(1) : "4.6"}
                </span>
              </div>
              <p className="text-xs text-orange-100">Avg Rating</p>
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-20 right-16 opacity-10">
            <div className="h-0 w-0 border-l-90 border-r-90 border-b-160 border-l-transparent border-r-transparent border-b-white" />
          </div>
        </div>

        {/* RIGHT INTERACTIVE PANEL */}
        <div className="flex flex-1 items-center justify-center bg-[#fafafa] px-6 py-10">
          <div className="w-full max-w-md">
            {/* Logo Mobile */}
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-amber-500/30 overflow-hidden bg-white">
                <Image src="/logo.png" alt="AcademyFind Logo" width={80} height={80} className="w-16 h-16 object-cover" />
              </div>
              <h3 className="text-sm font-bold tracking-[0.25em] text-slate-900">
                ACADEMYFIND
              </h3>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-500">
                Password Recovery
              </p>
            </div>

            {/* Step Progress Pills */}
            <div className="mb-6 flex items-center justify-center gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  step === "email"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {step === "otp" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white">
                    1
                  </span>
                )}
                <span>1. Request Code</span>
              </div>
              <div className="h-0.5 w-6 bg-slate-200" />
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  step === "otp"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-400 text-[9px] text-white">
                  2
                </span>
                <span>2. Reset Password</span>
              </div>
            </div>

            {/* STEP 1: EMAIL ENTRY */}
            {step === "email" ? (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    Forgot Password?
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Enter the email associated with your account and we'll send you a 6-digit recovery code.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSendOtp}>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Email Address <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        placeholder="e.g. yourname@example.com"
                        value={email}
                        required
                        autoFocus
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 font-semibold text-white shadow-md transition-all hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending Code...
                      </>
                    ) : (
                      <>
                        Send Reset Code <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-amber-500 hover:text-amber-600"
                  >
                    Back to Log In
                  </Link>
                </p>
              </div>
            ) : (
              /* STEP 2: OTP & PASSWORD RESET */
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    Set New Password
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-semibold text-slate-800 break-all">{email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline cursor-pointer"
                  >
                    <ArrowLeft className="h-3 w-3" /> Change Email
                  </button>
                </div>

                <form className="space-y-4" onSubmit={handleResetPassword}>
                  {/* 6-DIGIT OTP */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Verification Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      required
                      autoFocus={!otp}
                      className="h-13 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-2xl font-bold tracking-[0.5em] font-mono outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  {/* NEW PASSWORD */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        required
                        autoFocus={Boolean(otp && otp.length === 6)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* CONFIRM NEW PASSWORD */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Validation Indicators */}
                  <div className="space-y-1 pt-1 text-xs">
                    <div
                      className={`flex items-center gap-1.5 ${
                        isPasswordValid ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>At least 8 characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        doPasswordsMatch ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Passwords match</span>
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      otp.length < 6 ||
                      !isPasswordValid ||
                      !doPasswordsMatch
                    }
                    className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 font-semibold text-white shadow-md transition-all hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Setting Password...
                      </>
                    ) : (
                      "Set New Password"
                    )}
                  </button>
                </form>

                {/* Resend OTP */}
                <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
                  <p>
                    Didn't receive the code?{" "}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading || cooldown > 0}
                      className="font-semibold text-amber-500 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
                    </button>
                  </p>

                  <Link
                    href="/login"
                    className="text-xs text-slate-400 hover:text-slate-600 hover:underline mt-1"
                  >
                    Back to Log In
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
