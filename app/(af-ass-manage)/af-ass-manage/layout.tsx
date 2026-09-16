import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Building2,
    Users,
    FolderTree,
    FileText,
    ArrowLeft,
    MapPin,
    FileType2,
    Contact,
    Pyramid,
    Briefcase,
    LifeBuoy,
    PhoneCall,
    IdCard,
    BellIcon,
    Star,
    BookOpen,
    UserCheck,
    MessageCircle,
    Wallet,
    Activity,
    Megaphone,
    Share2,
    KeyRound
} from "lucide-react";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { ReactNode } from "react";
import { ManagerSidebarWrapper } from "@/components/manager/ManagerSidebarWrapper";
import { SidebarLink } from "@/components/manager/SidebarLink";
import { ScrollToTopAdmin } from "@/components/admin/ScrollToTopAdmin";
import { AdminSidebarSearch } from "@/components/admin/AdminSidebarSearch";

export const metadata: Metadata = {
    title: "Admin Control Panel | AcademyFind",
    robots: {
        index: false,
        follow: false,
    },
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. Strict Security Check: Sirf Admin allow hoga
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect('/login');
    }

    // if (!session.user.onboardingCompleted) {
    //     redirect('/onboarding');
    // }

    if (session.user.role !== "ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🛑</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
                <p className="text-slate-500">You do not have administrator privileges to view this page.</p>
                <Link href="/" className="text-blue-600 hover:underline">Return to Homepage</Link>
            </div>
        );
    }

    // 2. Fetch all counts (Added Life Coach, Payments, and Job Applications)
    const [
        claimCount,
        reviewCount,
        notificationCount,
        contactCount,
        instituteReqCount,
        lifeCoachCount,
        paymentCount,
        jobAppCount,
        enquiryCount,
        blogCount,
        adCount,
        inboundLeadCount,
        unlockCount,
    ] = await Promise.all([
        prisma.instituteClaim.count({ where: { status: "PENDING" } }),
        prisma.review.count({ where: { status: "PENDING" } }),
        prisma.adminNotification.count({ where: { userId: session.user.id, isRead: false } }),
        prisma.contactMessage.count({ where: { isRead: false } }),
        prisma.instituteRequest.count({ where: { status: "PENDING" } }),
        prisma.lifeCoachRequest.count({ where: { status: "PENDING" } }),
        prisma.subscriptionPayment.count({ where: { status: "PENDING" } }),
        prisma.jobApplication.count({ where: { status: "NEW" } }),
        prisma.instituteEnquiry.count({
            where: {
                status: "NEW",
                isForwarded: false,
                source: {
                    notIn: [
                        'GOOGLE_ADS',
                        'META_ADS',
                        'WEBSITE_WEBHOOK',
                        'ZAPIER',
                        'LINKEDIN',
                        'EXTERNAL_WEBHOOK',
                    ]
                }
            }
        }),
        prisma.blogPost.count({ where: { status: { in: ["PENDING_REVIEW", "CONTACTED"] } } }),
        prisma.advertisement.count({ where: { status: "PENDING" } }),
        prisma.inboundLead.count({ where: { status: "NEW" } }),
        prisma.instituteUnlock.count(),
    ]);

    // New route counts
    const [pendingMemberships, pendingChatReports, salesManagerUpdateCount, pendingSalesRequests] = await Promise.all([
        prisma.instituteMembership.count({ where: { status: "PENDING" } }),
        prisma.messageReport.count({ where: { status: "PENDING" } }),
        prisma.adminNotification.count({ where: { userId: session.user.id, type: "SALES_ASSIGNMENT_UPDATE", isRead: false } }),
        prisma.salesAssignmentRequest.count({ where: { status: "PENDING" } }),
    ]);

    return (
        <div className="bg-[#FAF8F5] min-h-screen pb-12">
            <div className="w-full lg:pt-6 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6">

                {/* --- ADMIN SIDEBAR --- */}
                <ManagerSidebarWrapper title="Admin Center">
                    <div>
                        <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-stone-800 mb-6 transition-colors font-medium">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Main Site
                        </Link>
                        <h2 className="font-extrabold text-2xl text-slate-900 leading-tight tracking-tight">
                            Admin Center
                        </h2>
                        <span className="inline-block mt-3 text-[10px] uppercase tracking-wider font-bold bg-stone-100/80 text-stone-800 px-3 py-1 rounded-full border border-stone-200">
                            Superuser Mode
                        </span>
                    </div>

                    <AdminSidebarSearch />

                    <nav className="flex flex-col gap-1.5 mt-2">
                        <SidebarLink href="/af-ass-manage" icon={<LayoutDashboard />} label="Overview" />
                        <SidebarLink href="/af-ass-manage/analytics" icon={<Activity />} label="Analytics & Stats" exact />
                        <SidebarLink href="/af-ass-manage/analytics/visitors" icon={<Activity className="opacity-50" />} label="↳ Live Visitors" />
                        <SidebarLink href="/af-ass-manage/notifications" icon={<BellIcon />} label="Notifications" count={notificationCount} />

                        {/* 👇 Yahan naye counts pass kiye hain */}
                        <SidebarLink href="/af-ass-manage/life-coach" icon={<LifeBuoy />} label="Life Coach" count={lifeCoachCount} />
                        <SidebarLink href="/af-ass-manage/claims" icon={<FileText />} label="Claim Requests" count={claimCount} />
                        <SidebarLink href="/af-ass-manage/reviews" icon={<Star />} label="Review Requests" count={reviewCount} />
                        <SidebarLink href="/af-ass-manage/instituteRequests" icon={<FileType2 />} label="Institute Requests" count={instituteReqCount} />
                        <SidebarLink href="/af-ass-manage/instituteCallbacks" icon={<PhoneCall />} label="Institute Callbacks" count={enquiryCount} />
                        <SidebarLink href="/af-ass-manage/unlocks" icon={<KeyRound />} label="Contact Unlocks" count={unlockCount} />
                        <SidebarLink href="/af-ass-manage/lead-integrations" icon={<Share2 />} label="Ad & Webhook Leads" count={inboundLeadCount} />
                        <SidebarLink href="/af-ass-manage/contactmessages" icon={<Contact />} label="Contact Messages" count={contactCount} />
                        <SidebarLink href="/af-ass-manage/payments" icon={<Pyramid />} label="Payment Approvals" count={paymentCount} />
                        <SidebarLink href="/af-ass-manage/advertisements" icon={<Megaphone />} label="Advertisements" count={adCount} />

                        <SidebarLink href="/af-ass-manage/institutes" icon={<Building2 />} label="All Institutes" />
                        <SidebarLink href="/af-ass-manage/users" icon={<Users />} label="User Management" />
                        <SidebarLink href="/af-ass-manage/sales_manager" icon={<Briefcase />} label="Sales Managers" count={salesManagerUpdateCount} />
                        <SidebarLink href="/af-ass-manage/sales_requests" icon={<Briefcase />} label="↳ Assignment Requests" count={pendingSalesRequests} />

                        {/* 👇 Careers me jobAppCount pass kiya hai */}
                        <SidebarLink href="/af-ass-manage/careers" icon={<IdCard />} label="Careers" count={jobAppCount} />
                        <SidebarLink href="/af-ass-manage/blog" icon={<BookOpen />} label="Blog Management" count={blogCount} />

                        <div className="my-2 border-t border-stone-100/50"></div>
                        <SidebarLink href="/af-ass-manage/categories" icon={<FolderTree />} label="Categories" />
                        <SidebarLink href="/af-ass-manage/cities" icon={<MapPin />} label="Cities & Regions" />

                        <div className="my-2 border-t border-stone-100/50"></div>
                        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-900/40 mt-2 mb-1">Platform Tools</p>
                        <SidebarLink href="/af-ass-manage/memberships" icon={<UserCheck />} label="Memberships" count={pendingMemberships} />
                        <SidebarLink href="/af-ass-manage/chat" icon={<MessageCircle />} label="Chat Reports" count={pendingChatReports} />
                        <SidebarLink href="/af-ass-manage/wallets" icon={<Wallet />} label="Wallets" />
                    </nav>
                </ManagerSidebarWrapper>

                {/* --- MAIN ADMIN CONTENT AREA --- */}
                <main className="flex-1 min-w-0 max-w-full bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(120,113,108,0.06)] p-5 lg:p-8 min-h-[calc(100vh-4rem)]">
                    {children}
                </main>

                <ScrollToTopAdmin />
            </div>
        </div>
    );
}


