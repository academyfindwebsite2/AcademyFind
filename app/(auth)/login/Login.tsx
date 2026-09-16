"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Star,
  Loader2, // Added for loading spinner
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import Image from "next/image";
import { authClient } from "@/lib/auth/auth-client";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "@/lib/auth/auth";
import { useMobileApp } from "@/hooks/useMobileApp";
import { PlatformStats } from "@/lib/stats";
import { getAuthRedirectTarget } from "@/lib/auth/redirect-utils";

export default function LoginComponent({ stats }: { stats?: PlatformStats }) {
  const [method, setMethod] = useState<"email" | "phone">("email");

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setphone] = useState("");
  const [password, setPassword] = useState("");
  const { isMobileApp } = useMobileApp();

  // Nayi States for OTP and Loading
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

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (method !== "email") {
      toast.error("Phone login will be implemented separately.");
      return;
    }

    if (!email.trim()) {
      toast.error("Please enter email");
      return;
    }

    if (!password.trim()) {
      toast.error("Please enter password");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: redirectTarget, // Sahi password hone par yahan jayega
      });

      if (error) {
        // Agar email verify nahi hai, toh auto-send OTP and show UI
        if (error?.message?.toLowerCase().includes("not verified")) {
          const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
            email: email,
            type: "email-verification",
          });

          if (!otpError) {
            toast.success("Account not verified. We've sent a new code to your email!", {
              duration: 4000,
            });
            setShowOtpScreen(true); // OTP UI dikhao
          } else {
            toast.error("Failed to send verification code. Try again later.");
          }
          return;
        }

        // Agar password galat hai ya koi aur error hai
        if (error) {
          toast.error("Some issues in login")
          return;
        }

      }

      // Login Successful!
      toast.success("Welcome back!");
      router.push(redirectTarget);
    } catch (error) {
      console.error("Login Error:", error);
      toast.error("Something went wrong during login.");
    } finally {
      setIsLoading(false);
    }
  }

  // Naya Function: Verify OTP and Login
  async function handleVerifyAndLogin(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return;

    setIsLoading(true);

    try {
      // 1. Verify OTP
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });

      if (verifyError) {
        toast.error("Invalid OTP: " + verifyError.message);
        setOtp("")
        setIsLoading(false);
        return;
      }

      // 2. Auto Login using the password from state
      const { error: loginError } = await authClient.signIn.email({
        email,
        password,
      });

      if (loginError) {
        toast.error("Email verified, but auto-login failed. Please login manually.");
        setShowOtpScreen(false);
      } else {
        toast.success("Verified and logged in successfully!");
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
        <div className="relative hidden w-1/2 overflow-hidden bg-linear-to-b from-amber-400 to-amber-500 p-12 text-white lg:flex lg:flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-amber-500/30 bg-white/90 backdrop-blur">
              <Image src="/logo.png" alt="AcademyFind Logo" width={120} height={120} />
            </div>
            <span className="font-semibold">
              AcademyFind
              <p className="text-[0.6rem]">Academy Search Simplified</p>
            </span>
          </div>

          {/* Content */}
          <div className="mt-24 max-w-sm">
            <h1 className="text-5xl font-bold leading-tight">
              Find the Right Institute Before You Join
            </h1>
            <p className="mt-5 text-orange-100">
              Discover, compare and choose India's best coaching institutes.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-14 flex flex-wrap gap-4">
            <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur-md">
              <p className="text-2xl font-bold">
                {stats?.instituteCount !== undefined
                  ? `${stats.instituteCount.toLocaleString("en-IN")}`
                  : "41,000+"}
              </p>
              <p className="text-sm text-orange-100">Institutes</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur-md">
              <p className="text-2xl font-bold">
                {stats?.cityCount !== undefined
                  ? `${stats.cityCount.toLocaleString("en-IN")}+`
                  : "9+"}
              </p>
              <p className="text-sm text-orange-100">Cities</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-white text-white" />
                <span className="text-2xl font-bold">
                  {stats?.avgRating !== undefined ? stats.avgRating.toFixed(1) : "4.6"}
                </span>
              </div>
              <p className="text-sm text-orange-100">Avg Rating</p>
            </div>
          </div>

          {/* Decorative Triangle */}
          <div className="absolute bottom-20 right-16 opacity-10">
            <div className="h-0 w-0 border-l-90 border-r-90 border-b-160 border-l-transparent border-r-transparent border-b-white" />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-1 items-center justify-center bg-[#fafafa] px-6 py-10">
          <div className="w-full max-w-md">
            {/* Logo Mobile */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-amber-500/30">
                <Image src="/logo.png" alt="AcademyFind Logo" width={120} height={120} />
              </div>
              <h3 className="text-sm font-bold tracking-[0.25em] text-slate-900">
                ACADEMYFIND
              </h3>
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
                    We've sent a 6-digit verification code to <br />
                    <strong className="text-slate-800">{email}</strong>
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
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-70 cursor-pointer"
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
                  Didn't request this?{" "}
                  <button
                    onClick={() => setShowOtpScreen(false)}
                    className="font-semibold text-amber-400 hover:text-amber-500"
                  >
                    Go Back
                  </button>
                </p>
              </div>
            ) : (
              /* ================= ORIGINAL LOGIN UI ================= */
              <div className="animate-in fade-in duration-300">
                {/* Heading */}
                <div className="mb-6 text-center">
                  <h2 className="text-3xl font-bold bg-linear-to-r from-amber-500 to-rose-200 bg-clip-text text-transparent">
                    Welcome Back
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Log in to your AcademyFind account
                  </p>
                </div>

                {/* Toggle */}
                {/* <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMethod("email")}
                    className={`flex items-center justify-center gap-2 cursor-pointer rounded-lg py-2 text-sm font-medium transition-all ${
                      method === "email"
                        ? "bg-amber-400 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    <Mail size={16} />
                    Email
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("phone")}
                    className={`flex items-center justify-center gap-2 cursor-pointer rounded-lg py-2 text-sm font-medium transition-all ${
                      method === "phone"
                        ? "bg-amber-400 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    <Phone size={16} />
                    Phone
                  </button>
                </div> */}

                <form className="space-y-5" onSubmit={handleLogin}>
                  {/* Email / Phone */}
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
                        placeholder={
                          method === "email"
                            ? "Enter your email"
                            : "Enter mobile number"
                        }
                        value={method === "email" ? email : phone}
                        onChange={(e) => {
                          if (method === "email") setEmail(e.target.value);
                          else setphone(e.target.value);
                        }}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        Password <span className="text-red-500">*</span>
                      </label>

                      <Link
                        href="/forgot-password"
                        className="text-xs text-amber-400 hover:text-amber-500"
                      >
                        Forgot Password?
                      </Link>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
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

                  {/* Login */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Logging in...
                      </>
                    ) : (
                      "Log In"
                    )}
                  </button>
                </form>

                {/* Divider */}
                {!isMobileApp && (
                  <>
                    <div className="my-6 flex items-center">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="mx-4 text-xs text-slate-400">OR</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    {/* Google Login */}
                    <button
                      type="button"
                      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={handleGoogleLogin}
                    >
                      <FcGoogle size={20} />
                      Continue with Google
                    </button>
                  </>
                )}

                {/* Signup */}
                <p className="mt-8 text-center text-sm text-slate-500">
                  Don't have an account?{" "}
                  <Link
                    href={
                      redirectTarget && redirectTarget !== "/"
                        ? `/register?callbackUrl=${encodeURIComponent(redirectTarget)}`
                        : "/register"
                    }
                    className="font-semibold text-amber-400 hover:text-amber-500"
                  >
                    Sign Up for free
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}