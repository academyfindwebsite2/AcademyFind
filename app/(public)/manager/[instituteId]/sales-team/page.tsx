import { prisma } from "@/lib/prisma";
import { formatIST } from "@/lib/utils";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  TrendingUp,
  ChevronRight,
  Building2,
  CalendarDays,
  History,
  PhoneCall,
  MessageSquare,
  Clock,
  ArrowRight,
  FileText,
  CheckCircle2,
} from "lucide-react";
import IsmManageClient from "./IsmManageClient";

export default async function SalesTeamPage({
  params,
}: {
  params: Promise<{ instituteId: string }>;
}) {
  const { instituteId } = await params;

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { name: true },
  });

  const [ismAssignments, pendingInvites, recentActivities] = await Promise.all([
    prisma.instituteSalesManagerAssignment.findMany({
      where: { instituteId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ismInviteRequest.findMany({
      where: { instituteId, status: "PENDING" },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ismLeadActivity.findMany({
      where: {
        enquiry: { instituteId },
      },
      include: {
        ism: { select: { name: true, email: true } },
        enquiry: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  type IsmAssignmentItem = (typeof ismAssignments)[number];
  type RecentActivityItem = (typeof recentActivities)[number];

  interface IsmStat {
    userId: string;
    totalLeads: number;
    newLeads: number;
    followUps: number;
    converted: number;
  }

  // Per-ISM stats
  const ismStats: IsmStat[] = await Promise.all(
    ismAssignments.map(async (assignment: IsmAssignmentItem): Promise<IsmStat> => {
      const userId = assignment.userId;
      const [totalLeads, newLeads, followUps, converted] = await Promise.all([
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: { in: ["NEW", "PENDING"] } } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "FOLLOW_UP" } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, convertedToAdmission: true } }),
      ]);
      return { userId, totalLeads, newLeads, followUps, converted };
    })
  );
  const statsMap: Record<string, IsmStat> = Object.fromEntries(ismStats.map((s: IsmStat) => [s.userId, s]));

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-violet-100 text-violet-700 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            Sales Team
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage Institute Sales Managers for <strong>{institute?.name}</strong>.
          </p>
        </div>
        <div className="bg-violet-50 text-violet-800 border border-violet-100 px-4 py-2 rounded-2xl font-bold text-sm shrink-0">
          {ismAssignments.length} Active ISMs
        </div>
      </div>

      {/* Add ISM */}
      <IsmManageClient instituteId={instituteId} pendingInvites={pendingInvites} />

      {/* ISM List */}
      {ismAssignments.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 rounded-3xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-500">No Sales Managers assigned yet.</p>
          <p className="text-sm text-slate-400 mt-1">Add an ISM above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ismAssignments.map((assignment: IsmAssignmentItem) => {
            const stats = statsMap[assignment.userId] || {};
            const convRate = stats.totalLeads > 0 ? Math.round((stats.converted / stats.totalLeads) * 100) : 0;

            return (
              <div
                key={assignment.userId}
                className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden hover:border-violet-200 transition"
              >
                {/* ISM Info */}
                <div className="p-5 flex items-center gap-4">
                  {assignment.user.image ? (
                    <img src={assignment.user.image} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-700 font-extrabold text-lg flex items-center justify-center shrink-0">
                      {assignment.user.name?.[0] || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">{assignment.user.name || "Unknown"}</p>
                    <p className="text-xs text-slate-500 truncate">{assignment.user.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      Added {formatIST(assignment.createdAt, "dd MMM yyyy")}
                      {assignment.assignedBy?.name && ` by ${assignment.assignedBy.name}`}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-0 border-t border-slate-100 divide-x divide-slate-100">
                  {[
                    { label: "Leads", value: stats.totalLeads ?? 0, icon: <Users className="w-3.5 h-3.5" /> },
                    { label: "New", value: stats.newLeads ?? 0, icon: <TrendingUp className="w-3.5 h-3.5" /> },
                    { label: "Follow-ups", value: stats.followUps ?? 0, icon: <CalendarDays className="w-3.5 h-3.5" /> },
                    { label: "Converted", value: stats.converted ?? 0, icon: <GraduationCap className="w-3.5 h-3.5" /> },
                  ].map((s: { label: string; value: number; icon: React.ReactNode }) => (
                    <div key={s.label} className="p-3 text-center">
                      <div className="text-slate-400 flex justify-center mb-0.5">{s.icon}</div>
                      <p className="font-black text-slate-900 text-sm">{s.value}</p>
                      <p className="text-[10px] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Conversion bar */}
                {stats.totalLeads > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                      <span>Conversion Rate</span>
                      <span className="text-green-700 font-bold">{convRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div style={{ width: `${convRate}%` }} className="bg-green-500 h-full rounded-full transition-all duration-500" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <Link
                    href={`/institute_sales/${instituteId}/${assignment.userId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition"
                  >
                    <Building2 className="w-3.5 h-3.5" /> View Dashboard <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/manager/${instituteId}/sales-team/assign?ism=${assignment.userId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition"
                  >
                    Assign Leads
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Sales Team Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-violet-600" />
              Live Sales Team Activity Feed
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit log of all calls, follow-ups, and notes logged by your sales team across all leads.
            </p>
          </div>
          <Link
            href={`/manager/${instituteId}/leads`}
            className="text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl border border-violet-200 transition self-start sm:self-auto flex items-center gap-1"
          >
            Go to Leads Hub <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentActivities.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">No sales team activity recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              When sales managers log calls, follow-ups, or notes on assigned leads, activities will stream here live.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivities.map((act: RecentActivityItem) => {
              const isCall = act.type === "CALL_LOGGED" || act.type === "CALL";
              const isFollowUp = act.type === "FOLLOWUP_SET" || act.type === "FOLLOW_UP";
              const isStatus = act.type === "STATUS_CHANGED";
              const isConverted = act.type === "CONVERTED";
              const isWa = act.type === "WHATSAPP_SENT" || act.type === "WHATSAPP";
              const ismName = act.ism?.name || act.ism?.email || "Sales Manager";

              return (
                <div key={act.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/60 rounded-xl px-2.5 transition">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs shrink-0 mt-0.5 sm:mt-0">
                      {isCall ? (
                        <PhoneCall className="w-4 h-4 text-blue-600" />
                      ) : isFollowUp ? (
                        <Clock className="w-4 h-4 text-amber-600" />
                      ) : isConverted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isWa ? (
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                      ) : isStatus ? (
                        <ArrowRight className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-violet-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">
                          {isCall ? "📞 Call Logged" : isFollowUp ? "📅 Follow-up Set" : isStatus ? "📌 Status Changed" : isConverted ? "🎓 Admission" : "📝 Note"}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          by <strong className="text-slate-800 font-semibold">{ismName}</strong>
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          for lead{" "}
                          <Link
                            href={`/manager/${instituteId}/leads/${act.enquiry.id}`}
                            className="font-bold text-violet-700 hover:text-violet-900 hover:underline"
                          >
                            {act.enquiry.name}
                          </Link>
                        </span>
                      </div>
                      {act.content && (
                        <p className="text-slate-600 mt-1 line-clamp-1 italic bg-white px-2 py-1 rounded-lg border border-slate-100 inline-block">
                          "{act.content}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatIST(act.createdAt, "PP 'at' p")}
                    </span>
                    <Link
                      href={`/manager/${instituteId}/leads/${act.enquiry.id}`}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition"
                    >
                      Lead Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
