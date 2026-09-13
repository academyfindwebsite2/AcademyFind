import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { ManagerSidebarWrapper } from "@/components/manager/ManagerSidebarWrapper";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  CalendarClock,
  GraduationCap,
  MessageCircle,
  Building2,
} from "lucide-react";

import { IsmInstituteSwitcher } from "@/components/instituteSalesManager/IsmInstituteSwitcher";

export const metadata: Metadata = {
  title: "Institute Sales Dashboard | AcademyFind",
  robots: { index: false, follow: false },
};

export default async function InstituteSalesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ instituteId: string; userId: string }>;
}) {
  const { instituteId, userId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Must be the ISM themselves, an institute manager of this institute, or admin
  const isAdmin = session.user.role === "ADMIN";
  const isSelf = session.user.id === userId;
  const isInstituteManager = !!(await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  }));

  if (!isAdmin && !isSelf && !isInstituteManager) {
    return (
      <div className="p-12 text-center text-red-500 font-bold text-xl">
        Unauthorized Access!
      </div>
    );
  }

  // Verify ISM assignment exists
  const ismAssignment = await prisma.instituteSalesManagerAssignment.findUnique({
    where: { userId_instituteId: { userId, instituteId } },
    include: {
      user: { select: { name: true, email: true, role: true } },
      institute: { select: { name: true } },
    },
  });

  if (!ismAssignment || !ismAssignment.isActive) {
    return (
      <div className="p-12 text-center text-red-500 font-bold text-xl">
        This user is not an active Sales Manager for this institute.
      </div>
    );
  }

  // All assignments for this ISM (for switching institutes)
  const allAssignments = await prisma.instituteSalesManagerAssignment.findMany({
    where: { userId, isActive: true },
    include: { institute: { select: { id: true, name: true } } },
  });

  const { user: ismUser, institute } = ismAssignment;

  return (
    <div className="bg-slate-50/50 min-h-screen pb-12">
      <div className="container mx-auto max-w-7xl pt-8 px-4 flex flex-col md:flex-row gap-8">

        {/* SIDEBAR */}
        <ManagerSidebarWrapper title="ISM Dashboard">
          <div>
            <div className="flex items-center justify-between mb-4">
              <Link href={`/manager/${instituteId}`} className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 transition-colors">
                <ArrowLeft className="w-3 h-3 mr-1" /> Institute
              </Link>
              {allAssignments.length > 1 && (
                <Link href="/institute_sales" className="text-xs font-bold text-violet-600 hover:underline">
                  Switch ({allAssignments.length})
                </Link>
              )}
            </div>
            <h2 className="font-extrabold text-xl text-slate-900 leading-tight">
              {ismUser.name || "Sales Manager"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{ismUser.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full">
                ISM
              </span>
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" /> {institute.name}
              </span>
            </div>

            {allAssignments.length > 1 && (
              <IsmInstituteSwitcher
                currentInstituteId={instituteId}
                userId={userId}
                assignments={allAssignments}
              />
            )}
          </div>

          <nav className="flex flex-col gap-1.5 mt-6">
            <SidebarLink href={`/institute_sales/${instituteId}/${userId}`} icon={<LayoutDashboard />} label="Dashboard" />
            <SidebarLink href={`/institute_sales/${instituteId}/${userId}/leads`} icon={<Users />} label="My Leads" />
            <SidebarLink href={`/institute_sales/${instituteId}/${userId}/followups`} icon={<CalendarClock />} label="Follow-ups" />
            <SidebarLink href={`/institute_sales/${instituteId}/${userId}/admissions`} icon={<GraduationCap />} label="Admissions" />
            <SidebarLink href="/chat" icon={<MessageCircle />} label="Chat & Messages" />
          </nav>
        </ManagerSidebarWrapper>

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 max-w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 md:p-8 min-h-[600px] overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-violet-50 hover:text-violet-700 text-slate-600"
    >
      <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      {label}
    </Link>
  );
}
