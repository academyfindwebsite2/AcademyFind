"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Crown,
  Trophy,
  BarChart3,
  Users,
  MessageSquare,
  Sparkles,
  BarChart2,
  Sliders,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_BENEFITS, PlanConfig, PlanFeature } from "@/lib/subscription/plans";

interface SubscriptionClientProps {
  currentPlan: string;
  currentBillingCycle: string;
  instituteId: string;
}

export default function SubscriptionClient({
  currentPlan,
  currentBillingCycle,
  instituteId,
}: SubscriptionClientProps) {
  const [isAnnual, setIsAnnual] = useState(true); // Default to annual as shown in main image
  const router = useRouter();

  const planPriority: Record<string, number> = {
    BASIC: 0,
    VERIFIED: 1,
    PREMIUM: 2,
    ULTRA: 3,
  };
  const currentPlanRank = planPriority[currentPlan] ?? 0;

  const handleCheckout = (planId: string) => {
    router.push(
      `/manager/${instituteId}/subscription/checkout/${planId}?billingCycle=${
        isAnnual ? "ANNUAL" : "MONTHLY"
      }`
    );
  };

  const renderFeatureItem = (feature: PlanFeature, index: number) => {
    // 🏆 Special Highlight Box: Trophy
    if (feature.highlight === "trophy") {
      return (
        <li
          key={index}
          className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
            <Trophy className="w-4 h-4 text-amber-950" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
              {feature.text}
            </h4>
            {feature.subtext && (
              <p className="text-[11px] text-slate-500 mt-1 leading-snug font-medium">
                {feature.subtext}
              </p>
            )}
          </div>
        </li>
      );
    }

    // 📊 Special Highlight Box: LMS
    if (feature.highlight === "lms") {
      return (
        <li
          key={index}
          className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
            <BarChart3 className="w-4 h-4 text-amber-950" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                {feature.text}
              </h4>
              {feature.badge && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                  {feature.badge}
                </span>
              )}
            </div>
            {feature.subtext && (
              <p className="text-[11px] text-slate-500 mt-1 leading-snug font-medium">
                {feature.subtext}
              </p>
            )}
          </div>
        </li>
      );
    }

    // 👥 Special Feature: Users (Showcase students and teachers)
    if (feature.highlight === "users") {
      return (
        <li key={index} className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-xs">
            <Users className="w-2.5 h-2.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 leading-tight block">
              {feature.text}
            </span>
            {feature.subtext && (
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">
                {feature.subtext}
              </p>
            )}
          </div>
        </li>
      );
    }

    // 💬 Special Feature: Forum
    if (feature.highlight === "forum") {
      return (
        <li key={index} className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-xs">
            <MessageSquare className="w-2.5 h-2.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 leading-tight block">
              {feature.text}
            </span>
            {feature.subtext && (
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">
                {feature.subtext}
              </p>
            )}
          </div>
        </li>
      );
    }

    // Standard Feature Item
    return (
      <li key={index} className="flex items-start gap-2.5">
        <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-xs">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`text-xs sm:text-sm leading-tight block ${
              feature.isBold ? "font-bold text-slate-900" : "font-medium text-slate-700"
            }`}
          >
            {feature.text}
          </span>
          {feature.subtext && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">
              {feature.subtext}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 font-sans pb-12">
      {/* 🚀 Top Header Section */}
      <div className="relative text-center pt-4 sm:pt-6">
        {/* Decorative Top Right Slogan */}
        <div className="hidden md:block absolute right-4 top-2 text-right">
          <span className="text-sm lg:text-base font-bold text-slate-800 tracking-wide transform -rotate-3 inline-block font-serif italic text-amber-900/90">
            Education
            <br />
            Connects People
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
          Subscription <span className="text-amber-500">Plan</span>
        </h1>
        <p className="text-sm sm:text-base font-semibold text-slate-500 mt-2">
          Get Discovered. Attract Students. Grow Faster.
        </p>

        {/* 🚀 Billing Toggle: Monthly vs Annually */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="bg-sky-50/60 p-1.5 rounded-full inline-flex border border-sky-100/80 shadow-xs relative">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`relative z-10 px-7 py-2 text-xs sm:text-sm font-bold rounded-full transition-all duration-200 cursor-pointer ${
                !isAnnual
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`relative z-10 px-7 py-2 text-xs sm:text-sm font-bold rounded-full transition-all duration-200 cursor-pointer ${
                isAnnual
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Annually
            </button>
          </div>

          {/* Curved arrow pointing to Annual option */}
          <div className="hidden sm:flex items-center gap-1.5 text-[#059669]">
            <svg
              className="w-8 h-6 text-[#059669] transform -rotate-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10h10a5 5 0 0 1 5 5v2m0 0l-3-3m3 3l3-3"
              />
            </svg>
            <span className="text-xs sm:text-sm font-bold italic tracking-tight font-serif">
              Save more
              <br />
              with Annual Plan
            </span>
          </div>
        </div>
      </div>

      {/* 🚀 Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-2">
        {SUBSCRIPTION_PLANS.map((plan: PlanConfig) => {
          const isVerified = plan.id === "VERIFIED";
          const isPremium = plan.id === "PREMIUM";
          const isElite = plan.id === "ULTRA";

          const priceData = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
          const isCurrentCycleAndPlan =
            currentPlan === plan.id &&
            ((isAnnual && currentBillingCycle === "ANNUAL") ||
              (!isAnnual && currentBillingCycle === "MONTHLY"));

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 bg-white ${
                isPremium
                  ? "border-2 border-amber-400 shadow-xl shadow-amber-200/40 md:-translate-y-2 z-10"
                  : "border border-slate-200/90 shadow-sm hover:border-amber-300 hover:shadow-md"
              }`}
            >
              {/* Crown / Top Badge for Premium */}
              {isPremium && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider px-5 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>MOST POPULAR</span>
                </div>
              )}

              {/* Best Growth Badge for Elite */}
              {isElite && (
                <div className="absolute -top-3 right-6 bg-emerald-100/90 text-emerald-800 font-extrabold text-[10px] sm:text-xs px-3 py-1 rounded-full border border-emerald-200 shadow-xs">
                  Best for Maximum Growth
                </div>
              )}

              {/* Top Card Info */}
              <div>
                {/* Plan Title */}
                <h3 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
                  {plan.name}
                </h3>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-snug min-h-[36px]">
                  {plan.desc}
                </p>

                {/* Pricing Area */}
                <div className="mt-5 mb-6 pb-5 border-b border-slate-100">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tight">
                      ₹{priceData.offer.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">
                      /{isAnnual ? "yr" : "mo"}
                    </span>

                    {/* Annual Save Pill */}
                    {isAnnual && (
                      <span className="ml-auto bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                        Save with
                        <br />
                        Annual Plan
                      </span>
                    )}
                  </div>

                  {/* Strikethrough original price if Annual */}
                  {isAnnual && priceData.original && (
                    <div className="text-xs text-slate-400 font-semibold line-through mt-0.5">
                      ₹{priceData.original.toLocaleString("en-IN")}
                    </div>
                  )}
                </div>

                {/* Feature List */}
                <ul className="space-y-3.5 mb-8">
                  {plan.features.map((feature, i) => renderFeatureItem(feature, i))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  disabled={
                    isCurrentCycleAndPlan || currentPlanRank > (planPriority[plan.id] ?? 0)
                  }
                  onClick={() => handleCheckout(plan.id)}
                  className={`w-full py-6 rounded-2xl font-black text-sm sm:text-base transition-all duration-200 cursor-pointer ${
                    isCurrentCycleAndPlan
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : currentPlanRank > (planPriority[plan.id] ?? 0)
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : isVerified
                      ? "bg-white border-2 border-amber-400 text-slate-900 hover:bg-amber-400 shadow-xs hover:shadow-md"
                      : "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-md hover:shadow-lg shadow-amber-400/20"
                  }`}
                >
                  {isCurrentCycleAndPlan
                    ? "Active Plan"
                    : currentPlan === plan.id
                    ? isAnnual
                      ? "Switch to Annual"
                      : "Switch to Monthly"
                    : currentPlanRank > (planPriority[plan.id] ?? 0)
                    ? "Included in current plan"
                    : plan.actionText}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🚀 Bottom Benefits Banner */}
      <div className="bg-amber-50/40 border border-amber-200/70 rounded-3xl p-6 sm:p-8 mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Reach More Students */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Reach More Students</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                Get discovered by thousands of students and parents.
              </p>
            </div>
          </div>

          {/* 2. Better Enquiries */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
              <BarChart2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Better Enquiries</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                Quality leads that convert.
              </p>
            </div>
          </div>

          {/* 3. Manage Easily */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
              <Sliders className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Manage Easily</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                Save time with powerful tools like LMS.
              </p>
            </div>
          </div>

          {/* 4. Grow Faster */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
              <Rocket className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Grow Faster</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                Build your brand and increase admissions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 Footer Callout */}
      <div className="text-center pt-2">
        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
          Join AcademyFind Today
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
          More Students. Better Opportunities. A Brighter Future.
        </p>
      </div>
    </div>
  );
}