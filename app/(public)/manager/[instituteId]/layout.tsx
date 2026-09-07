import { PremiumLock } from "@/components/manager/PremiumLock";
import { ManagerSidebarWrapper } from "@/components/manager/ManagerSidebarWrapper";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, ArrowRight, BarChart2, BarChart3, CreditCard, LayoutDashboardIcon, MessageSquare, User, UserRound, Users, PackageOpen, MessageCircle, FileText, Zap, Building2, Sparkles } from "lucide-react";
import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ManagerSidebarLink } from "@/components/manager/ManagerSidebarLink";

export const metadata: Metadata = {
    title: "Manager Control Panel | AcademyFind",
    robots: {
        index: false,
        follow: false,
    },
};

export default async function ManagerDashBoardLayout({
    children, params
}: {
    children: React.ReactNode;
    params: any;
}) {
    const { instituteId } = await params;
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Oops! You are not logged in.</h1>
                <p className="text-slate-500 mb-8 max-w-md">You need to log in with an authorized manager account to access this dashboard.</p>
                <Link href="/login" className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                    Log In Now
                </Link>
            </div>
        )
    }

    const isAuthorized = await prisma.instituteManager.findUnique({
        where: {
            userId_instituteId: {
                userId: session.user.id,
                instituteId: instituteId
            },
        }
    })

    if (session.user.role !== "ADMIN" && !isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Access Denied</h1>
                <p className="text-slate-500 mb-8 max-w-md">You do not have manager permissions for this institute. Please contact the administrator if you believe this is a mistake.</p>
                <Link href="/" className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                    Return Home
                </Link>
            </div>
        )
    }

    // BACKFILL: Ensure manager has an active InstituteMembership
    if (isAuthorized) {
        const membership = await prisma.instituteMembership.findFirst({
            where: { userId: session.user.id, instituteId, role: 'MANAGER' }
        });
        if (!membership) {
            await prisma.instituteMembership.create({
                data: {
                    userId: session.user.id,
                    instituteId,
                    role: 'MANAGER',
                    status: 'ACTIVE',
                    joinedAt: new Date(),
                    isActive: true
                }
            });
            // Also ensure channel membership
            const { ensureInstituteChannels } = await import("@/lib/chat/ensureInstituteChannels");
            await ensureInstituteChannels(instituteId);
            const channels = await prisma.conversation.findMany({
                where: { instituteId: instituteId, type: 'INSTITUTE' }
            });
            if (channels.length > 0) {
                await prisma.conversationParticipant.createMany({
                    data: channels.map((ch: { id: string }) => ({
                        conversationId: ch.id,
                        userId: session.user.id,
                        role: 'MANAGER' // 
                    })),
                    skipDuplicates: true
                });
            }
        }
    }

    const institute = await prisma.institute.findUnique({
        where: { id: instituteId },
        select: { name: true, subscriptionPlan: true, planExpiresAt: true }
    });

    if (!institute) return <div>Institute not found.</div>;

    // Count pending membership requests
    const pendingCount = await prisma.instituteMembership.count({
        where: { instituteId, status: "PENDING" },
    });

    const plan = institute.subscriptionPlan; // BASIC, PREMIUM, ULTRA

    // Automatic Expiry Notification Check
    if (plan !== "BASIC" && institute.planExpiresAt) {
        const expiresAt = new Date(institute.planExpiresAt);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // If plan expires in 7 days or less, and it hasn't expired yet
        if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
            // Check if we already notified them recently (within the last 7 days)
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const existingNotification = await prisma.userNotification.findFirst({
                where: {
                    userId: session.user.id,
                    entityId: instituteId,
                    type: "SYSTEM",
                    createdAt: { gte: sevenDaysAgo }
                }
            });

            if (!existingNotification) {
                await prisma.userNotification.create({
                    data: {
                        userId: session.user.id,
                        entityId: instituteId,
                        type: "SYSTEM",
                        title: "Plan Expiring Soon",
                        body: `Your ${plan} plan for ${institute.name} expires in ${daysUntilExpiry} days. Please renew to keep your premium features active!`,
                        isRead: false
                    }
                });
            }
        }
    }

    return (
        <div className="relative bg-[#f9f6f0] min-h-screen pb-12 selection:bg-[#ebdbb7]/40 selection:text-stone-900 font-sans">
            {/* Grainy Noise Overlay */}
            <div className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            <div className="w-full max-w-[1600px] mx-auto pt-4 lg:pt-6 px-4 lg:px-8 flex flex-col lg:flex-row gap-6 lg:gap-8 relative z-10">

                {/* --- SIDEBAR --- */}
                <ManagerSidebarWrapper title={institute.name}>
                    {/* Header */}
                    <div>
                        <Link href="/manager" className="inline-flex items-center text-xs text-stone-500 hover:text-stone-800 mb-6 transition-colors font-medium">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Switch Workspace
                        </Link>
                        <h2 className="font-extrabold text-2xl text-stone-900 leading-tight tracking-tight">
                            {institute.name}
                        </h2>
                        <div className="mt-3 flex flex-col gap-2.5 items-start w-full">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold bg-amber-500/15 text-amber-900 px-3 py-1 rounded-full border border-amber-500/30 shadow-xs">
                                    {plan} PLAN
                                </span>
                                {plan !== "BASIC" && institute.planExpiresAt && (
                                    <span className="text-[11px] text-slate-500 font-medium tracking-wide">
                                        Expires {new Date(institute.planExpiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </div>

                            {/* Prominent Subscription Card right below the Plan badge */}
                            <Link
                                href={`/manager/${instituteId}/subscription`}
                                className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 p-[1px] shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
                            >
                                <div className="relative rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 p-3 text-white">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                                <CreditCard className="h-4 w-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-100">
                                                    Subscription
                                                </p>
                                                <p className="text-xs font-black text-white flex items-center gap-1">
                                                    Upgrade / Subscribe <Sparkles className="w-3 h-3 text-amber-200 fill-amber-200 inline" />
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-6 w-6 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                                            <ArrowRight className="w-3.5 h-3.5 text-white transition-transform group-hover:translate-x-0.5" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex flex-col gap-1.5 mt-2">
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}`}
                            icon={<LayoutDashboardIcon />}
                            label="Overview"
                        />
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/profile`}
                            icon={<Building2 />}
                            label="Institute Profile"
                        />
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/subscription`}
                            icon={<CreditCard />}
                            label="Subscription"
                            badge="Plans"
                            className="bg-amber-500/10 text-amber-900 font-bold border border-amber-500/30 hover:bg-amber-500/20"
                        />
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/team`}
                            icon={<UserRound />}
                            label="Add Team Member"
                        />
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/members`}
                            icon={<Users />}
                            label="Members"
                            badge={pendingCount > 0 ? pendingCount : undefined}
                            locked={plan === "BASIC" || plan == "VERIFIED"}
                        />
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/batches`}
                            icon={<PackageOpen />}
                            label="Batches"
                            locked={plan == "BASIC" || plan == "VERIFIED"}
                        />
                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/chat`}
                            icon={<MessageCircle />}
                            label="Institute Chat"
                            locked={plan == "BASIC" || plan == "VERIFIED"}
                        />
                        <ManagerSidebarLink href={`/manager/${instituteId}/leads`} icon={<MessageSquare />} label="Student Leads" locked={plan === "BASIC" || plan == "VERIFIED"} />

                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/blogs`}
                            icon={<FileText />}
                            label="Articles"
                            locked={plan === "BASIC" || plan === "VERIFIED"}
                        />

                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/metrics`}
                            icon={<BarChart2 />}
                            label="Metrics"
                            locked={plan === "BASIC" || plan === "VERIFIED"}
                        />

                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/analytics`}
                            icon={<BarChart3 />}
                            label="Analytics"
                            locked={plan === "BASIC" || plan === "VERIFIED"}
                        />

                        <ManagerSidebarLink
                            href={`/manager/${instituteId}/integrations`}
                            icon={<Zap />}
                            label="Integrations"
                            locked={plan === "BASIC" || plan === "VERIFIED"}
                        />
                    </nav>
                </ManagerSidebarWrapper>

                {/* --- MAIN CONTENT AREA --- */}
                <main className="flex-1 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 lg:p-10 min-h-[calc(100vh-4rem)]">
                    {children}
                </main>

            </div>
        </div>
    );
}

