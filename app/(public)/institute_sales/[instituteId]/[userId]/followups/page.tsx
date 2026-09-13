import { prisma } from "@/lib/prisma";
import { formatIST } from "@/lib/utils";
import Link from "next/link";
import { CalendarClock, AlertTriangle, Phone, ChevronRight, CheckCircle2 } from "lucide-react";

export default async function IsmFollowUpsPage({
  params,
}: {
  params: Promise<{ instituteId: string; userId: string }>;
}) {
  const { instituteId, userId } = await params;
  const now = new Date();

  const [overdueLeads, upcomingLeads] = await Promise.all([
    prisma.instituteEnquiry.findMany({
      where: {
        instituteId,
        assignedIsmId: userId,
        nextFollowUp: { lt: now },
        convertedToAdmission: false,
        status: { notIn: ["APPROVED", "JUNK"] },
      },
      orderBy: { nextFollowUp: "asc" },
    }),
    prisma.instituteEnquiry.findMany({
      where: {
        instituteId,
        assignedIsmId: userId,
        nextFollowUp: { gte: now },
        convertedToAdmission: false,
      },
      orderBy: { nextFollowUp: "asc" },
    }),
  ]);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
          <div className="p-2 bg-orange-100 text-orange-700 rounded-xl">
            <CalendarClock className="w-6 h-6" />
          </div>
          Follow-up Schedule
        </h1>
        <p className="text-sm text-slate-500 mt-1">Stay on top of your lead follow-ups.</p>
      </div>

      {/* Overdue */}
      {overdueLeads.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Overdue ({overdueLeads.length})
          </h2>
          <div className="space-y-2">
            {overdueLeads.map((lead: any) => (
              <Link
                key={lead.id}
                href={`/institute_sales/${instituteId}/${userId}/leads/${lead.id}`}
                className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-2xl hover:border-red-300 transition group"
              >
                <div>
                  <p className="font-bold text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {lead.phone}
                  </p>
                  {lead.followUpNote && (
                    <p className="text-xs text-red-600 mt-1 italic">"{lead.followUpNote}"</p>
                  )}
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <p className="text-xs font-bold text-red-700">
                      Was due: {formatIST(lead.nextFollowUp, "dd MMM · hh:mm a")}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-300 group-hover:text-red-500 transition" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="space-y-3">
        <h2 className="font-bold text-slate-700 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-orange-500" /> Upcoming ({upcomingLeads.length})
        </h2>
        {upcomingLeads.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-slate-200 rounded-3xl">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-medium text-sm">No upcoming follow-ups scheduled.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingLeads.map((lead: any) => (
              <Link
                key={lead.id}
                href={`/institute_sales/${instituteId}/${userId}/leads/${lead.id}`}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-violet-300 hover:bg-violet-50/30 transition group"
              >
                <div>
                  <p className="font-bold text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {lead.phone}
                  </p>
                  {lead.followUpNote && (
                    <p className="text-xs text-slate-500 mt-1 italic">"{lead.followUpNote}"</p>
                  )}
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <p className="text-xs font-bold text-orange-600">
                      {formatIST(lead.nextFollowUp, "dd MMM")}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatIST(lead.nextFollowUp, "hh:mm a")}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
