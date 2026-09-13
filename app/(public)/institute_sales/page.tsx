import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  GraduationCap,
  Users,
  Clock,
  CheckCircle2,
  Mail,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Institute Sales Portal | AcademyFind",
  robots: { index: false, follow: false },
};

export default async function InstituteSalesPortalPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;

  // 1. Fetch all active assignments for this user
  const assignments = await prisma.instituteSalesManagerAssignment.findMany({
    where: { userId, isActive: true },
    include: {
      institute: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Fetch pending invites
  const pendingInvites = await prisma.ismInviteRequest.findMany({
    where: { userId, status: "PENDING" },
    include: {
      institute: {
        select: { id: true, name: true, logo: true },
      },
      sentBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // If exactly 1 assignment and no pending invites, automatically redirect to it
  if (assignments.length === 1 && pendingInvites.length === 0) {
    redirect(`/institute_sales/${assignments[0].instituteId}/${userId}`);
  }

  // Calculate summary stats for each assigned institute
  const instituteStats = await Promise.all(
    assignments.map(async (a) => {
      const [totalLeads, activeFollowUps, totalAdmissions] = await Promise.all([
        prisma.instituteEnquiry.count({
          where: { instituteId: a.instituteId, assignedIsmId: userId },
        }),
        prisma.instituteEnquiry.count({
          where: {
            instituteId: a.instituteId,
            assignedIsmId: userId,
            status: "FOLLOW_UP",
          },
        }),
        prisma.instituteEnquiry.count({
          where: {
            instituteId: a.instituteId,
            assignedIsmId: userId,
            convertedToAdmission: true,
          },
        }),
      ]);
      return {
        instituteId: a.instituteId,
        totalLeads,
        activeFollowUps,
        totalAdmissions,
      };
    })
  );
  const statsMap = Object.fromEntries(
    instituteStats.map((s) => [s.instituteId, s])
  );

  return (
    <div className="min-h-screen bg-slate-50/60 py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                <GraduationCap className="w-3.5 h-3.5" /> Institute Sales Portal
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900">
              Welcome back, {session.user.name || "Sales Manager"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select an institute below to access your leads, follow-ups, and admissions dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 shadow-xs">
              {assignments.length} Assigned Institutes
            </span>
          </div>
        </div>

        {/* Pending Invites Alert */}
        {pendingInvites.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Mail className="w-4 h-4 text-amber-600" />
              <span>You have {pendingInvites.length} pending Sales Manager invite{pendingInvites.length > 1 ? "s" : ""}:</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pendingInvites.map((invite: any) => (
                <div
                  key={invite.id}
                  className="bg-white p-4 rounded-2xl border border-amber-100 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {invite.institute.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        From: {invite.sentBy.name || invite.sentBy.email}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/ism-invite/${invite.id}`}
                    className="shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Respond
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned Institutes */}
        {assignments.length === 0 ? (
          <div className="p-16 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No active institute assignments</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              You have not been assigned to any institutes yet. When an institute manager invites you, your pending invites will appear here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-600" />
              Your Institutes ({assignments.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {assignments.map((assignment: any) => {
                const inst = assignment.institute;
                const stats = statsMap[inst.id] || {
                  totalLeads: 0,
                  activeFollowUps: 0,
                  totalAdmissions: 0,
                };

                return (
                  <Link
                    key={assignment.id}
                    href={`/institute_sales/${inst.id}/${userId}`}
                    className="group bg-white border border-slate-200 hover:border-violet-300 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          {inst.logo ? (
                            <Image
                              src={inst.logo}
                              alt={inst.name}
                              width={44}
                              height={44}
                              className="rounded-2xl border object-cover"
                            />
                          ) : (
                            <div className="w-11 h-11 bg-violet-100 text-violet-700 rounded-2xl flex items-center justify-center font-bold">
                              {inst.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-slate-900 text-base group-hover:text-violet-700 transition line-clamp-1">
                              {inst.name}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-1">
                              {inst.address || "Active Partner"}
                            </p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-violet-50 group-hover:text-violet-600 flex items-center justify-center text-slate-400 transition">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Mini stats */}
                      <div className="grid grid-cols-3 gap-2.5 my-4">
                        <div className="bg-slate-50 rounded-2xl p-3 text-center">
                          <span className="block text-lg font-black text-slate-900">{stats.totalLeads}</span>
                          <span className="block text-[11px] font-semibold text-slate-500">My Leads</span>
                        </div>
                        <div className="bg-amber-50 rounded-2xl p-3 text-center">
                          <span className="block text-lg font-black text-amber-700">{stats.activeFollowUps}</span>
                          <span className="block text-[11px] font-semibold text-amber-600">Follow-ups</span>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                          <span className="block text-lg font-black text-emerald-700">{stats.totalAdmissions}</span>
                          <span className="block text-[11px] font-semibold text-emerald-600">Admissions</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-violet-600">
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
