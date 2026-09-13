import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  MessageSquare,
  Clock,
  MessageCircle,
  ClipboardList,
  CalendarClock,
} from "lucide-react";
import IsmLeadDetailClient from "./IsmLeadDetailClient";

const activityIcon = (type: string) => {
  switch (type) {
    case "WHATSAPP_SENT": return <MessageCircle className="w-4 h-4 text-emerald-500" />;
    case "CALL_LOGGED": return <Phone className="w-4 h-4 text-blue-500" />;
    case "NOTE": return <ClipboardList className="w-4 h-4 text-violet-500" />;
    case "FOLLOWUP_SET": return <CalendarClock className="w-4 h-4 text-orange-500" />;
    case "CONVERTED": return <span className="text-base">🎉</span>;
    case "STATUS_CHANGED": return <Clock className="w-4 h-4 text-slate-400" />;
    default: return <Clock className="w-4 h-4 text-slate-400" />;
  }
};

export default async function IsmLeadDetailPage({
  params,
}: {
  params: Promise<{ instituteId: string; userId: string; leadId: string }>;
}) {
  const { instituteId, userId, leadId } = await params;

  const lead = await prisma.instituteEnquiry.findUnique({
    where: { id: leadId },
    include: {
      institute: { select: { id: true, name: true, phone: true } },
      ismActivities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      admissionRecord: {
        include: { installments: { orderBy: { dueDate: "asc" } } },
      },
    },
  });

  if (!lead || lead.instituteId !== instituteId) return notFound();

  // Build WA auto-log URL
  const waLogUrl = `/api/ism/wa-log/${leadId}?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.name)}&institute=${encodeURIComponent(lead.institute?.name || "")}`;

  const statusColor = (s: string) => {
    switch (s) {
      case "NEW": case "PENDING": return "bg-amber-100 text-amber-800";
      case "CALLED": return "bg-emerald-100 text-emerald-700";
      case "MESSAGED": return "bg-purple-100 text-purple-700";
      case "FOLLOW_UP": return "bg-orange-100 text-orange-700";
      case "APPROVED": return "bg-green-100 text-green-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Back */}
      <Link
        href={`/institute_sales/${instituteId}/${userId}/leads`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      {/* Lead Header */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-800 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold mb-1 flex items-center gap-2">
              <User className="w-6 h-6 opacity-70" /> {lead.name}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-violet-200">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {lead.email}</span>}
              {lead.institute && (
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {lead.institute.name}</span>
              )}
            </div>
            <p className="text-xs text-violet-300 mt-2">
              Enquired: {formatIST(lead.createdAt, "dd MMM yyyy · hh:mm a")}
            </p>
          </div>
          <span className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase ${statusColor(lead.status)}`}>
            {lead.status.replace("_", " ")}
          </span>
        </div>

        {/* Message */}
        {lead.message && (
          <div className="mt-4 p-3 bg-white/10 rounded-xl text-sm text-violet-100 italic">
            <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
            "{lead.message}"
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: CRM Actions (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          <IsmLeadDetailClient lead={lead} instituteId={instituteId} userId={userId} waLogUrl={waLogUrl} />
        </div>

        {/* Right: Activity History (2/5) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm sticky top-4">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> Activity History
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {lead.ismActivities.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">No activity yet.</div>
              ) : (
                lead.ismActivities.map((act: any) => (
                  <div key={act.id} className="p-4 flex gap-3">
                    <div className="mt-0.5 shrink-0">{activityIcon(act.type)}</div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-600 font-medium leading-snug">{act.content}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatIST(act.createdAt, "dd MMM · hh:mm a")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
