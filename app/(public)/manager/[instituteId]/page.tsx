import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Building2,
    MessageSquare,
    Star,
    Bookmark,
    ArrowRight,
    Sparkles
} from "lucide-react";
import { InstituteQRCode } from "@/components/manager/InstituteQRCode";
import { Metadata } from "next";
export const metadata: Metadata = {
    title: "Manager Control Panel | AcademyFind",
    robots: {
        index: false,
        follow: false,
    },
};
export default async function InstituteDashboardOverview({
    params
}: {
    params: Promise<{ instituteId: string }>
}) {
    // 🚀 Next.js 15 Async Params Fix
    const { instituteId } = await params;

    // Fetch Institute with related aggregate counts
    const institute = await prisma.institute.findUnique({
        where: { id: instituteId },
        include: {
            _count: {
                select: {
                    reviews: true,
                    shortlistedBy: true,
                    enquiries: true
                }
            },
        }
    });

    if (!institute) redirect("/manager");

    const plan = institute.subscriptionPlan; // BASIC, PREMIUM, ULTRA

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Welcome Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 md:p-8 bg-gradient-to-r from-[#292524] to-[#1c1917] text-white rounded-3xl shadow-md relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-64 h-64 bg-[#ebdbb7] rounded-full blur-[120px] opacity-10 opacity-20 pointer-events-none"></div>

                <div className="space-y-2 relative z-10">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                        Welcome back, Manager! 👋
                    </h1>
                    <p className="text-stone-300 text-sm max-w-xl">
                        You can manage your institute's profile, leads, and more from here.
                    </p>
                </div>

                <div className="shrink-0 relative z-10 flex flex-col items-start md:items-end gap-2">
                    <Badge className="bg-amber-400 hover:bg-amber-500 text-stone-900 font-bold px-4 py-1.5 rounded-xl uppercase tracking-wider text-xs">
                        {plan} PLAN
                    </Badge>
                    {plan !== "BASIC" && institute.planExpiresAt && (
                        <span className="text-[10px] text-amber-100 font-medium tracking-wide">
                            Expires {new Date(institute.planExpiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    )}
                    <Link href={`/manager/${instituteId}/subscription`} className="mt-0.5">
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-stone-950 font-black shadow-lg shadow-amber-500/25 rounded-xl text-xs h-8 px-3.5 flex items-center gap-1.5 transition-all hover:scale-[1.03]"
                        >
                            <Sparkles className="w-3.5 h-3.5 fill-stone-950 text-stone-950" />
                            Subscribe / Upgrade Plan
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Stat 1: Rating & Reviews */}
                <Card className="rounded-2xl border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.2,1,0.2,1)] hover:scale-[1.01]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-500">Public Rating</CardTitle>
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        {/* Platform Rating */}
                        <div>
                            <div className="text-xl font-bold text-stone-800 flex items-baseline gap-1">
                                {(institute.averageRating || 0).toFixed(1)}
                                <span className="text-sm font-medium text-stone-500">/ 5.0</span>
                            </div>
                            <p className="text-[11px] text-stone-400 mt-0.5">
                                Based on {institute.reviewCount || 0} platform reviews
                            </p>
                        </div>
                        
                        <div className="h-px bg-stone-100" />
                        
                        {/* Google Rating */}
                        <div>
                            <div className="text-sm font-bold text-stone-600 flex items-baseline gap-1">
                                {institute.googleRating ? institute.googleRating.toFixed(1) : "0.0"} 
                                <span className="text-xs font-medium text-stone-400">/ 5.0</span>
                            </div>
                            <p className="text-[11px] text-stone-400 mt-0.5">
                                Based on {institute.googleReviewCount || 0} Google reviews
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Stat 2: Student Enquiries (Conditional UI) */}
                <Card className="rounded-2xl border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,1,0.2,1)] hover:scale-[1.01]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-500">Student Leads</CardTitle>
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        {plan === "BASIC" ? (
                            <div>
                                <div className="text-xl font-bold text-stone-400 flex items-center gap-1.5">
                                    Locked <span>🔒</span>
                                </div>
                                <p className="text-xs text-blue-600 font-medium mt-1 hover:underline">
                                    <Link href={`/manager/${instituteId}/subscription`}>Upgrade to unlock leads &rarr;</Link>
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="text-2xl font-bold text-stone-800">
                                    {institute._count.enquiries} Active Leads
                                </div>
                                <p className="text-xs text-stone-400 mt-1">
                                    Total enquiries received via platform
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Stat 3: Saves / Shortlists (Conditional UI) */}
                <Card className="rounded-2xl border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.2,1,0.2,1)] hover:scale-[1.01]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-500">Saves Count</CardTitle>
                        <Bookmark className="w-4 h-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {plan !== "ULTRA" && plan !== "PREMIUM" ? (
                            <div>
                                <div className="text-xl font-bold text-stone-400 flex items-center gap-1.5">
                                    Premium/Elite Only <span>🔒</span>
                                </div>
                                <p className="text-xs text-stone-400 mt-1">
                                    Audience analysis needs Premium or Elite Plan
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="text-2xl font-bold text-stone-800">
                                    {institute._count.shortlistedBy} Students
                                </div>
                                <p className="text-xs text-stone-400 mt-1">
                                    Students who have saved your academy
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Action Cards / Next Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {/* Profile Completion Prompt */}
                <Card className="rounded-2xl border-white/60 p-6 flex flex-col justify-between space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.2,1,0.2,1)] hover:scale-[1.01]">
                    <div className="space-y-2">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-stone-800">Update Profile Details</h3>
                        <p className="text-stone-500 text-sm leading-relaxed">
                            Update your coaching center's name, description, fee structure, and accurate address to ensure a smooth onboarding experience for students.
                        </p>
                    </div>
                    <Button asChild className="w-full justify-between bg-white text-stone-800 border hover:bg-stone-100 rounded-xl">
                        <Link href={`/manager/${instituteId}/profile`}>
                            Go to Profile Editor <ArrowRight className="w-4 h-4" />
                        </Link>
                    </Button>
                </Card>

                {/* Plan Promotion Prompt */}
                {plan === "PREMIUM" || plan === "ULTRA" ? (
                    <Card className="rounded-2xl border-purple-100 p-6 flex flex-col justify-between space-y-4 shadow-sm bg-gradient-to-br from-purple-50/30 to-white">
                        <div className="space-y-2">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-lg text-stone-800">Premium Analytics</h3>
                            <p className="text-stone-500 text-sm leading-relaxed">
                                Profile visibility and reach on AcademyFind.
                            </p>
                        </div>
                        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                            <div className="text-3xl font-black text-purple-600">{institute.viewCount}</div>
                            <p className="text-xs font-bold text-purple-800 uppercase tracking-wide mt-1">
                                Total Page Views
                            </p>
                        </div>
                    </Card>
                ) : (
                    <Card className="rounded-2xl border-amber-100 p-6 flex flex-col justify-between space-y-4 shadow-sm bg-gradient-to-br from-amber-50/30 to-white">
                        <div className="space-y-2">
                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-lg text-stone-800">Premium Utilities</h3>
                            <p className="text-stone-500 text-sm leading-relaxed">
                                If you want to unlock advanced features like lead tracking, audience insights, and more, consider upgrading your subscription plan.
                            </p>
                        </div>
                        <Button asChild className="w-full justify-between bg-amber-500 hover:bg-amber-600 text-white rounded-xl cursor-pointer">
                            <Link href={`/manager/${instituteId}/subscription`}>
                                View Plans & Pricing <ArrowRight className="w-4 h-4" />
                            </Link>
                        </Button>
                    </Card>
                )}
                
                <InstituteQRCode slug={institute.slug} />
            </div>
        </div>
    );
}