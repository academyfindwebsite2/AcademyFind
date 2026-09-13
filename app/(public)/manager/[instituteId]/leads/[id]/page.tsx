import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Mail, Phone, Calendar, ArrowLeft, User, MessageSquare, UserCheck, Clock, CheckCircle2, FileText, PhoneCall, History, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import IsmAssignDropdown from "@/components/instituteSalesManager/IsmAssignDropdown";

interface ActivityMeta {
  outcome?: string;
  notes?: string;
  oldStatus?: string;
  newStatus?: string;
}

interface LeadActivityDetailItem {
  id: string;
  type: string;
  content: string | null;
  meta?: ActivityMeta | null;
  createdAt: Date;
  ism?: {
    id?: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
}

interface LeadDetailData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message?: string | null;
  status: string;
  createdAt: Date;
  source?: string | null;
  assignedIsm?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  assignedIsmId?: string | null;
  admissionRecord?: {
    id: string;
    courseName: string | null;
    totalFee: number;
    paidAmount: number;
    studentName: string;
    installments: {
      id: string;
      amount: number;
      dueDate: Date;
      status: string;
      note?: string | null;
    }[];
  } | null;
  ismActivities?: LeadActivityDetailItem[];
  nextFollowUp?: Date | string | null;
  followUpNote?: string | null;
  convertedToAdmission?: boolean;
}

export default async function LeadDetailedPage({ params }: { params: Promise<{ id: string; instituteId: string }> }) {
    const { id, instituteId } = await params;

    const [enquiry, activeIsms] = await Promise.all([
        prisma.instituteEnquiry.findUnique({
            where: { id },
            include: {
                assignedIsm: {
                    select: { id: true, name: true, email: true, image: true },
                },
                admissionRecord: {
                    include: { installments: true },
                },
                ismActivities: {
                    include: {
                        ism: { select: { id: true, name: true, email: true, image: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 50,
                },
            },
        }),
        prisma.instituteSalesManagerAssignment.findMany({
            where: { instituteId, isActive: true },
            include: { user: { select: { id: true, name: true, email: true } } },
        }),
    ]);

    let enquiryData: LeadDetailData | null = enquiry as LeadDetailData | null;
    let isInbound = false;

    if (!enquiryData) {
        const inbound = await prisma.inboundLead.findUnique({
            where: { id },
        });
        if (!inbound) return notFound();
        isInbound = true;
        enquiryData = {
            id: inbound.id,
            name: inbound.name,
            phone: inbound.phone,
            email: inbound.email,
            message: inbound.message,
            status: inbound.status,
            createdAt: inbound.createdAt,
            assignedIsm: null,
            assignedIsmId: null,
            admissionRecord: null,
            ismActivities: [],
            nextFollowUp: null,
            followUpNote: inbound.notes,
            convertedToAdmission: false,
            source: inbound.source,
        };
    }
    const lead: LeadDetailData = enquiryData;

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* 🚀 Back Button */}
            <Link href={`/manager/${instituteId}/leads`} className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Leads
            </Link>

            <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 pb-8 border-b border-stone-100">
                    <div>
                        <h1 className="text-3xl font-extrabold text-stone-900 mb-2 flex items-center gap-3">
                            {lead.name}
                        </h1>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-[#ebdbb7]/30 text-stone-900 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                Status: {lead.status}
                            </span>
                            {lead.source && (
                                <span className="bg-stone-100 text-stone-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Source: {lead.source}
                                </span>
                            )}
                            {lead.convertedToAdmission && (
                                <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Converted to Admission
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-right text-sm text-stone-500 font-medium flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        {formatIST(lead.createdAt, "PPP 'at' p")}
                    </div>
                </div>

                {/* 🚀 Sales Manager Assignment Card (Only for direct enquiries with ISM support) */}
                {!isInbound && (
                    <div className="mb-8 p-5 bg-violet-50/60 border border-violet-100 rounded-2xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-violet-100 text-violet-700 rounded-xl">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Assigned Sales Manager</p>
                                    <p className="text-sm font-semibold text-slate-900">
                                        {lead.assignedIsm ? (lead.assignedIsm.name || lead.assignedIsm.email) : "Unassigned"}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <IsmAssignDropdown
                                    enquiryId={lead.id}
                                    instituteId={instituteId}
                                    currentIsmId={lead.assignedIsmId || null}
                                    isms={activeIsms}
                                />
                            </div>
                        </div>

                        {lead.nextFollowUp && (
                            <div className="mt-3 pt-3 border-t border-violet-100/80 flex items-center gap-2 text-xs text-violet-800">
                                <Clock className="w-3.5 h-3.5 text-violet-600" />
                                <span>Next Follow-up scheduled for: <strong>{formatIST(lead.nextFollowUp, "PPP 'at' p")}</strong></span>
                            </div>
                        )}
                        {lead.followUpNote && (
                            <p className="mt-2 text-xs text-slate-600 bg-white/70 p-2.5 rounded-xl border border-violet-100/50">
                                <span className="font-semibold text-slate-700">Follow-up note:</span> {lead.followUpNote}
                            </p>
                        )}
                    </div>
                )}

                {/* 🚀 Contact Details */}
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Contact Information</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-100 hover:border-emerald-200 hover:bg-emerald-50 transition group">
                        <div className="p-2.5 bg-white rounded-xl shadow-xs text-emerald-500 group-hover:scale-110 transition"><Phone className="w-5 h-5" /></div>
                        <div>
                            <p className="text-xs font-medium text-stone-500">Mobile Number</p>
                            <p className="font-semibold text-stone-800">{lead.phone}</p>
                        </div>
                    </a>
                    {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-100 hover:border-blue-200 hover:bg-blue-50 transition group">
                            <div className="p-2.5 bg-white rounded-xl shadow-xs text-blue-500 group-hover:scale-110 transition"><Mail className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs font-medium text-stone-500">Email Address</p>
                                <p className="font-semibold text-stone-800">{lead.email}</p>
                            </div>
                        </a>
                    )}
                </div>

                {/* 🚀 Message Content */}
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Student Query</h3>
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 text-amber-900 leading-relaxed mb-8">
                    {lead.message ? (
                        <p className="whitespace-pre-wrap">{lead.message}</p>
                    ) : (
                        <p className="text-amber-700/60 italic">No specific message was provided by the student. They just requested a callback/contact.</p>
                    )}
                </div>

                {/* Inbound lead notes if present */}
                {isInbound && lead.followUpNote && (
                    <div className="mb-8 p-5 bg-stone-50 border border-stone-200 rounded-2xl">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Internal Lead Notes</h4>
                        <p className="text-xs text-stone-700 whitespace-pre-wrap">{lead.followUpNote}</p>
                    </div>
                )}

                {/* 🚀 Admission Details if converted */}
                {lead.admissionRecord && (
                    <div className="mb-8 p-6 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                        <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Admission Record
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-emerald-100">
                                <span className="text-slate-500 block">Course</span>
                                <span className="font-bold text-slate-800">{lead.admissionRecord.courseName}</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100">
                                <span className="text-slate-500 block">Total Fee</span>
                                <span className="font-bold text-slate-800">₹{lead.admissionRecord.totalFee.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100">
                                <span className="text-slate-500 block">Paid Amount</span>
                                <span className="font-bold text-emerald-700">₹{lead.admissionRecord.paidAmount.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100">
                                <span className="text-slate-500 block">Student Name</span>
                                <span className="font-bold text-slate-800">{lead.admissionRecord.studentName}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🚀 ISM Activity Timeline & Audit Trail */}
                <div className="pt-6 border-t border-stone-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                        <div>
                            <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                                <History className="w-5 h-5 text-violet-600" />
                                Sales Activity History & Audit Trail
                            </h3>
                            <p className="text-xs text-stone-500 mt-0.5">
                                Chronological timeline of calls, notes, follow-up schedules, and status changes by sales managers.
                            </p>
                        </div>
                        {lead.ismActivities && lead.ismActivities.length > 0 && (
                            <span className="text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1 rounded-full self-start sm:self-auto shrink-0">
                                {lead.ismActivities.length} {lead.ismActivities.length === 1 ? "Event Logged" : "Events Logged"}
                            </span>
                        )}
                    </div>

                    {!lead.ismActivities || lead.ismActivities.length === 0 ? (
                        <div className="p-8 text-center bg-stone-50/70 border border-dashed border-stone-200 rounded-2xl">
                            <Clock className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                            <h4 className="font-bold text-stone-700 text-sm">No Sales Activity Logged Yet</h4>
                            <p className="text-xs text-stone-400 mt-1 max-w-md mx-auto">
                                When the assigned sales manager ({lead.assignedIsm ? lead.assignedIsm.name || lead.assignedIsm.email : "an ISM"}) logs phone calls, schedules follow-ups, or adds notes, the complete history will appear here in real time.
                            </p>
                        </div>
                    ) : (
                        <div className="relative pl-6 border-l-2 border-stone-200 space-y-6">
                            {lead.ismActivities.map((act: LeadActivityDetailItem) => {
                                const actorName = act.ism?.name || act.ism?.email || "Sales Manager";
                                const isCall = act.type === "CALL_LOGGED" || act.type === "CALL";
                                const isFollowUp = act.type === "FOLLOWUP_SET" || act.type === "FOLLOW_UP";
                                const isStatus = act.type === "STATUS_CHANGED";
                                const isConverted = act.type === "CONVERTED";
                                const isWa = act.type === "WHATSAPP_SENT" || act.type === "WHATSAPP";

                                return (
                                    <div key={act.id} className="relative group">
                                        {/* Timeline Node Icon */}
                                        <div
                                            className={`absolute -left-[35px] top-0 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${
                                                isCall
                                                    ? "bg-blue-500 text-white"
                                                    : isFollowUp
                                                    ? "bg-amber-500 text-white"
                                                    : isStatus
                                                    ? "bg-indigo-500 text-white"
                                                    : isConverted
                                                    ? "bg-emerald-500 text-white"
                                                    : isWa
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-violet-500 text-white"
                                            }`}
                                        >
                                            {isCall ? (
                                                <PhoneCall className="w-4 h-4" />
                                            ) : isFollowUp ? (
                                                <Clock className="w-4 h-4" />
                                            ) : isStatus ? (
                                                <ArrowRight className="w-4 h-4" />
                                            ) : isConverted ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : isWa ? (
                                                <MessageSquare className="w-4 h-4" />
                                            ) : (
                                                <FileText className="w-4 h-4" />
                                            )}
                                        </div>

                                        {/* Activity Content Card */}
                                        <div className="bg-stone-50/80 hover:bg-stone-50 border border-stone-200/90 rounded-2xl p-4 transition-all shadow-2xs">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span
                                                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                                            isCall
                                                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                                                : isFollowUp
                                                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                                                : isStatus
                                                                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                                                : isConverted
                                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                                : "bg-violet-50 text-violet-800 border-violet-200"
                                                        }`}
                                                    >
                                                        {isCall
                                                            ? "📞 Phone Call Logged"
                                                            : isFollowUp
                                                            ? "📅 Follow-up Scheduled"
                                                            : isStatus
                                                            ? "📌 Status Changed"
                                                            : isConverted
                                                            ? "🎓 Converted to Admission"
                                                            : isWa
                                                            ? "💬 WhatsApp Sent"
                                                            : "📝 Discussion Note"}
                                                    </span>
                                                    <span className="text-xs text-stone-500">
                                                        by <strong className="text-stone-800 font-bold">{actorName}</strong>
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-medium text-stone-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatIST(act.createdAt, "PPP 'at' p")}
                                                </span>
                                            </div>

                                            {/* Extra structured details */}
                                            {act.content && (
                                                <p className="text-xs text-stone-800 font-medium whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-xl border border-stone-200/70 mt-2">
                                                    {act.content}
                                                </p>
                                            )}

                                            {/* Meta tags if available */}
                                            {act.meta && typeof act.meta === "object" && (
                                                <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs">
                                                    {act.meta.outcome && (
                                                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 border border-blue-200/60 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
                                                            Outcome: {act.meta.outcome}
                                                        </span>
                                                    )}
                                                    {act.meta.oldStatus && act.meta.newStatus && (
                                                        <span className="inline-flex items-center gap-1 bg-stone-100 border border-stone-200 text-stone-700 px-2.5 py-0.5 rounded-lg text-[11px]">
                                                            {act.meta.oldStatus} <ArrowRight className="w-3 h-3 text-stone-400" /> <strong className="text-stone-900 font-bold">{act.meta.newStatus}</strong>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}