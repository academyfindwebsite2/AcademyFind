import { prisma } from "@/lib/prisma";
import { formatIST } from "@/lib/utils";
import Link from "next/link";
import {
  Users,
  CalendarClock,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Building2,
  ChevronRight,
  Sparkles,
  Clock,
} from "lucide-react";

export default async function IsmDashboardPage({
  params,
}: {
  params: Promise<{ instituteId: string; userId: string }>;
}) {
  const { instituteId, userId } = await params;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [
    institute,
    totalLeads,
    newLeads,
    followUpLeads,
    convertedLeads,
    overdueFollowUps,
    recentLeads,
    upcomingFollowUps,
    totalAdmissions,
  ] = await Promise.all([
    prisma.institute.findUnique({ where: { id: instituteId }, select: { name: true } }),
    prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId } }),
    prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: { in: ["NEW", "PENDING"] } } }),
    prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "FOLLOW_UP" } }),
    prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, convertedToAdmission: true } }),
    prisma.instituteEnquiry.count({
      where: {
        instituteId,
        assignedIsmId: userId,
        nextFollowUp: { lt: now },
        convertedToAdmission: false,
        status: { notIn: ["APPROVED", "JUNK"] },
      },
    }),
    prisma.instituteEnquiry.findMany({
      where: { instituteId, assignedIsmId: userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.instituteEnquiry.findMany({
      where: {
        instituteId,
        assignedIsmId: userId,
        nextFollowUp: { gte: now },
        convertedToAdmission: false,
      },
      orderBy: { nextFollowUp: "asc" },
      take: 5,
    }),
    prisma.admissionRecord.count({ where: { instituteId, ismId: userId } }),
  ]);

  const statusColor = (s: string) => {
    switch (s) {
      case "NEW": case "PENDING": return "bg-amber-100 text-amber-800";
      case "CALLED": return "bg-emerald-100 text-emerald-700";
      case "MESSAGED": return "bg-purple-100 text-purple-700";
      case "FOLLOW_UP": return "bg-orange-100 text-orange-700";
      case "APPROVED": return "bg-green-100 text-green-700";
      case "JUNK": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-800 rounded-3xl p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-1">ISM Dashboard</h1>
            <p className="text-violet-200 max-w-lg text-sm">
              Managing leads for <span className="font-bold text-white">{institute?.name}</span>. Track contacts, schedule follow-ups, and convert leads to admissions.
            </p>
          </div>
          <Link
            href={`/institute_sales/${instituteId}/${userId}/leads`}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold rounded-xl transition"
          >
            View All Leads <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Leads", value: totalLeads, icon: <Users className="w-5 h-5" />, color: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "New / Pending", value: newLeads, icon: <Sparkles className="w-5 h-5" />, color: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Follow-ups", value: followUpLeads, icon: <CalendarClock className="w-5 h-5" />, color: "bg-orange-50 border-orange-200 text-orange-700" },
          { label: "Overdue", value: overdueFollowUps, icon: <AlertTriangle className="w-5 h-5" />, color: overdueFollowUps > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "Converted", value: convertedLeads, icon: <GraduationCap className="w-5 h-5" />, color: "bg-green-50 border-green-200 text-green-700" },
        ].map((stat) => (
          <div key={stat.label} className={`border rounded-2xl p-4 flex flex-col gap-2 ${stat.color}`}>
            <div className="opacity-60">{stat.icon}</div>
            <div className="text-2xl font-black">{stat.value}</div>
            <div className="text-xs font-semibold opacity-70">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Recent Leads */}
        <div className="border border-slate-200 bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> Recent Leads
            </h3>
            <Link href={`/institute_sales/${instituteId}/${userId}/leads`} className="text-xs font-bold text-violet-600 hover:underline">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLeads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No leads assigned yet.</div>
            ) : (
              recentLeads.map((lead: any) => (
                <Link
                  key={lead.id}
                  href={`/institute_sales/${instituteId}/${userId}/leads/${lead.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition group"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {lead.name}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="border border-slate-200 bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-orange-500" /> Upcoming Follow-ups
            </h3>
            <Link href={`/institute_sales/${instituteId}/${userId}/followups`} className="text-xs font-bold text-violet-600 hover:underline">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingFollowUps.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-slate-200" />
                <p>No upcoming follow-ups! 🎉</p>
              </div>
            ) : (
              upcomingFollowUps.map((lead: any) => (
                <Link
                  key={lead.id}
                  href={`/institute_sales/${instituteId}/${userId}/leads/${lead.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition group"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900">{lead.name}</p>
                    {lead.followUpNote && (
                      <p className="text-xs text-slate-500 line-clamp-1 italic mt-0.5">"{lead.followUpNote}"</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-orange-600">
                      {formatIST(lead.nextFollowUp, "dd MMM")}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatIST(lead.nextFollowUp, "hh:mm a")}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Admissions CTA */}
      {totalAdmissions > 0 && (
        <Link
          href={`/institute_sales/${instituteId}/${userId}/admissions`}
          className="flex items-center justify-between p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-3xl hover:border-green-300 transition group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-2xl text-green-700">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="font-extrabold text-green-800 text-lg">{totalAdmissions} Admissions</p>
              <p className="text-sm text-green-600">Track fee collection and installments</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-green-500 group-hover:translate-x-1 transition" />
        </Link>
      )}

    </div>
  );
}
