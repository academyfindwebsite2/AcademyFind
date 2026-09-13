"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Check,
  Crown,
  Trophy,
  BarChart3,
  Users,
  MessageSquare,
  BarChart2,
  Sliders,
  Rocket,
} from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_BENEFITS,
  PlanConfig,
  PlanFeature,
} from "@/lib/subscription/plans";

export function PricingModal({ children }: { children: React.ReactNode }) {
  const [isAnnual, setIsAnnual] = useState(true);

  const renderFeatureItem = (feature: PlanFeature, index: number) => {
    // 🏆 Special Highlight Box: Trophy
    if (feature.highlight === "trophy") {
      return (
        <li
          key={index}
          className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 shadow-xs"
        >
          <div className="w-7 h-7 rounded-xl bg-amber-400 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
            <Trophy className="w-3.5 h-3.5 text-amber-950" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
              {feature.text}
            </h4>
            {feature.subtext && (
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug font-medium">
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
          className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 shadow-xs"
        >
          <div className="w-7 h-7 rounded-xl bg-amber-400 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
            <BarChart3 className="w-3.5 h-3.5 text-amber-950" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                {feature.text}
              </h4>
              {feature.badge && (
                <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                  {feature.badge}
                </span>
              )}
            </div>
            {feature.subtext && (
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug font-medium">
                {feature.subtext}
              </p>
            )}
          </div>
        </li>
      );
    }

    // 👥 Special Feature: Users
    if (feature.highlight === "users") {
      return (
        <li key={index} className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-xs">
            <Users className="w-2.5 h-2.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-900 leading-tight block">
              {feature.text}
            </span>
            {feature.subtext && (
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug font-medium">
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
        <li key={index} className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-xs">
            <MessageSquare className="w-2.5 h-2.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-900 leading-tight block">
              {feature.text}
            </span>
            {feature.subtext && (
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug font-medium">
                {feature.subtext}
              </p>
            )}
          </div>
        </li>
      );
    }

    // Standard Feature Item
    return (
      <li key={index} className="flex items-start gap-2">
        <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-xs">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`text-xs leading-tight block ${
              feature.isBold ? "font-bold text-slate-900" : "font-medium text-slate-700"
            }`}
          >
            {feature.text}
          </span>
          {feature.subtext && (
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug font-medium">
              {feature.subtext}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent
        className="rounded-[2.5rem] border-0 p-6 md:p-8 bg-white max-h-[92vh] overflow-y-auto overflow-x-hidden w-[96vw] max-w-6xl shadow-2xl
        data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4
        data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Subscription Plans</DialogTitle>
          <DialogDescription>
            Upgrade your institute profile to get discovered, attract students, and grow faster.
          </DialogDescription>
        </DialogHeader>

        {/* 🚀 Header & Toggle */}
        <div className="relative text-center pt-2">
          {/* Decorative Top Right Slogan */}
          <div className="hidden sm:block absolute right-2 top-0 text-right">
            <span className="text-xs font-bold text-amber-900/90 tracking-wide transform -rotate-3 inline-block font-serif italic">
              Education
              <br />
              Connects People
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Subscription <span className="text-amber-500">Plan</span>
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            Get Discovered. Attract Students. Grow Faster.
          </p>

          {/* Toggle */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <div className="bg-sky-50/70 p-1.5 rounded-full inline-flex border border-sky-100 shadow-xs relative">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`relative z-10 px-6 py-1.5 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer ${
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
                className={`relative z-10 px-6 py-1.5 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer ${
                  isAnnual
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Annually
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[#059669]">
              <span className="text-xs font-bold italic tracking-tight font-serif">
                Save more with Annual Plan
              </span>
            </div>
          </div>
        </div>

        {/* 🚀 3 Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch pt-6">
          {SUBSCRIPTION_PLANS.map((plan: PlanConfig) => {
            const isVerified = plan.id === "VERIFIED";
            const isPremium = plan.id === "PREMIUM";
            const isElite = plan.id === "ULTRA";

            const priceData = isAnnual ? plan.pricing.annual : plan.pricing.monthly;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 bg-white ${
                  isPremium
                    ? "border-2 border-amber-400 shadow-xl shadow-amber-200/30"
                    : "border border-slate-200 shadow-sm hover:border-amber-300"
                }`}
              >
                {/* Crown badge for Premium */}
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-4 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <Crown className="w-3 h-3 fill-current" />
                    <span>MOST POPULAR</span>
                  </div>
                )}

                {/* Best Growth Badge for Elite */}
                {isElite && (
                  <div className="absolute -top-2.5 right-4 bg-emerald-100 text-emerald-800 font-extrabold text-[9px] px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-xs">
                    Best for Maximum Growth
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900 mt-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-snug min-h-[32px]">
                    {plan.desc}
                  </p>

                  {/* Price */}
                  <div className="mt-4 mb-4 pb-4 border-b border-slate-100">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-amber-500 tracking-tight">
                        ₹{priceData.offer.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        /{isAnnual ? "yr" : "mo"}
                      </span>

                      {isAnnual && (
                        <span className="ml-auto bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap">
                          Save with Annual Plan
                        </span>
                      )}
                    </div>

                    {isAnnual && priceData.original && (
                      <div className="text-[11px] text-slate-400 font-semibold line-through mt-0.5">
                        ₹{priceData.original.toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((feature, i) => renderFeatureItem(feature, i))}
                  </ul>
                </div>

                {/* Button */}
                <div className="pt-2">
                  <div
                    className={`w-full py-3 rounded-2xl font-black text-center text-xs sm:text-sm ${
                      isVerified
                        ? "bg-white border-2 border-amber-400 text-slate-900"
                        : "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                    }`}
                  >
                    {plan.actionText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 🚀 Bottom Benefits Banner */}
        <div className="bg-amber-50/40 border border-amber-200/70 rounded-3xl p-4 sm:p-5 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs">Reach More Students</h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Get discovered by thousands.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
                <BarChart2 className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs">Better Enquiries</h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Quality leads that convert.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
                <Sliders className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs">Manage Easily</h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Save time with tools like LMS.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
                <Rocket className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs">Grow Faster</h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Build brand & admissions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2">
          <h3 className="text-sm font-extrabold text-slate-900">Join AcademyFind Today</h3>
          <p className="text-[11px] text-slate-500 font-medium">
            More Students. Better Opportunities. A Brighter Future.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}