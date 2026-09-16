"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

import Link from "next/link";

interface Props {
  instituteId: string;
  isLoggedIn?: boolean;
}

export default function ReviewForm({ instituteId, isLoggedIn = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!comment.trim()) {
      setErrorMsg("Please write a comment before submitting.");
      return;
    }

    try {
      setLoading(true);

      // Backend API ko call kar rahe hain (File 1)
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituteId,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error ?? "Failed to submit review.");
        return;
      }

      // Success hone par UI update karein
      setSuccessMsg("Review submitted successfully! It is pending admin approval.");
      setComment("");
      setRating(5);

      // Page ka data refresh karein (without full reload)
      router.refresh();
      
    } catch {
      setErrorMsg("Something went wrong. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-16">
      <h2 className="text-3xl font-bold text-slate-900">
        Write a Review
      </h2>

      {!isLoggedIn ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm flex flex-col items-center justify-center">
          <div className="bg-amber-100 p-4 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Login Required</h3>
          <p className="text-slate-600 mb-6 max-w-md">
            You need to be logged in to share your experience and write a review for this institute.
          </p>
          <Link 
            href={buildAuthHref("/login", pathname)} 
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm"
          >
            Login to Review
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm"
        >
        {successMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-700 border border-emerald-100">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium leading-relaxed">{successMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-600 border border-red-100">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <div>
          <label className="mb-2 block font-semibold text-slate-700">
            Rating
          </label>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            disabled={loading || !!successMsg}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all disabled:opacity-60"
          >
            <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
            <option value={4}>⭐⭐⭐⭐ (4/5)</option>
            <option value={3}>⭐⭐⭐ (3/5)</option>
            <option value={2}>⭐⭐ (2/5)</option>
            <option value={1}>⭐ (1/5)</option>
          </select>
        </div>

        <div className="mt-6">
          <label className="mb-2 block font-semibold text-slate-700">
            Comment
          </label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={loading || !!successMsg}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all disabled:opacity-60"
            placeholder="Share your experience about the faculty, environment, fees etc..."
          />
        </div>

        <button
          disabled={loading || !!successMsg}
          className="mt-8 flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-8 py-3.5 font-bold text-white shadow-sm hover:bg-amber-600 focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 transition-all"
        >
          {loading ? "Submitting..." : successMsg ? "Submitted" : "Submit Review"}
        </button>
      </form>
      )}
    </section>
  );
}