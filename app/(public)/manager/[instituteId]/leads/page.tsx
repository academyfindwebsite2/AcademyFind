import { prisma } from "@/lib/prisma";
import {
  Lock,
  MessageSquare,
  Phone,
  Calendar,
  ArrowRight,
  Repeat,
  Info,
  Globe,
  MessageCircle,
  Zap,
  UserCheck,
  GraduationCap,
  Clock,
  AlertTriangle,
  Users,
  CheckCircle2,
  PhoneCall,
  FileText,
  Filter,
} from "lucide-react";
import { SiMeta, SiGoogle, SiZapier } from "react-icons/si";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import { PLAN_LIMITS, PlanType } from "@/lib/plan_limits";
import IsmAssignDropdown from "@/components/instituteSalesManager/IsmAssignDropdown";
import IsmFilterSelect from "@/components/instituteSalesManager/IsmFilterSelect";

interface LeadActivityItem {
  id: string;
  type: string;
  content: string | null;
  createdAt: Date;
  ism?: {
    name: string | null;
    email: string | null;
  } | null;
}

interface AssignedIsmInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AdmissionRecordInfo {
  id: string;
  courseName: string | null;
  totalFee: number;
  paidAmount: number;
  feeStatus: string;
}

interface UnifiedLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message?: string | null;
  status: string;
  createdAt: Date;
  source: string;
  isDirectPortal: boolean;
  parentId?: string | null;
  assignedIsmId?: string | null;
  assignedIsm?: AssignedIsmInfo | null;
  admissionRecord?: AdmissionRecordInfo | null;
  ismActivities?: LeadActivityItem[];
  nextFollowUp?: Date | string | null;
  followUpNote?: string | null;
  convertedToAdmission?: boolean;
}

interface SourceTab {
  id: string;
  label: string;
  count: number;
}

interface PipelineFilter {
  id: string;
  label: string;
  count: number;
  alert?: boolean;
}

export default async function EnquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ instituteId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { instituteId } = await params;
  const sp = await searchParams;

  const currentSource = sp?.source || "ALL";
  const currentPipeline = sp?.pipeline || "ALL";
  const currentIsm = sp?.ism || "ALL";

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
    },
  });

  if (!institute) return <div className="p-8 text-center text-stone-500">Institute not found</div>;

  const limits = PLAN_LIMITS[institute.subscriptionPlan as PlanType];

  if (!limits.hasLeads) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-stone-50/50 rounded-3xl border border-dashed border-stone-200">
        <div className="w-16 h-16 bg-[#ebdbb7]/30 text-stone-800 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">Student Leads Locked</h2>
        <p className="text-stone-500 max-w-md mb-6">
          Unlock direct student enquiries and lead generation from AcademyFind, Meta Ads, and Google Ads. Upgrade to the <b>Premium Plan</b> or <b>Ultra Plan</b>.
        </p>
        <Link
          href={`/manager/${instituteId}/subscription`}
          className="bg-stone-800 hover:bg-stone-900 text-white px-6 py-2.5 rounded-xl font-medium transition"
        >
          View Upgrade Plans
        </Link>
      </div>
    );
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Fetch direct portal enquiries with full ISM activity, admission records, and counts
  const [
    directEnquiries,
    inboundLeads,
    directCount,
    metaCount,
    googleCount,
    websiteCount,
    zapierCount,
    admissionsCount,
    unassignedCount,
    followUpCount,
    overdueCount,
    followUpTodayCount,
    activeIsms,
  ] = await Promise.all([
    prisma.instituteEnquiry.findMany({
      where: { instituteId },
      include: {
        assignedIsm: { select: { id: true, name: true, email: true, image: true } },
        admissionRecord: { select: { id: true, courseName: true, totalFee: true, paidAmount: true, feeStatus: true } },
        ismActivities: {
          include: { ism: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 2,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inboundLead.findMany({
      where: { instituteId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.instituteEnquiry.count({ where: { instituteId } }),
    prisma.inboundLead.count({ where: { instituteId, source: "META_ADS" } }),
    prisma.inboundLead.count({ where: { instituteId, source: "GOOGLE_ADS" } }),
    prisma.inboundLead.count({ where: { instituteId, source: "WEBSITE_WEBHOOK" } }),
    prisma.inboundLead.count({ where: { instituteId, source: "ZAPIER" } }),
    prisma.instituteEnquiry.count({ where: { instituteId, convertedToAdmission: true } }),
    prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: null } }),
    prisma.instituteEnquiry.count({ where: { instituteId, status: "FOLLOW_UP" } }),
    prisma.instituteEnquiry.count({
      where: {
        instituteId,
        nextFollowUp: { lt: now },
        convertedToAdmission: false,
      },
    }),
    prisma.instituteEnquiry.count({
      where: {
        instituteId,
        nextFollowUp: { gte: startOfToday, lte: endOfToday },
      },
    }),
    prisma.instituteSalesManagerAssignment.findMany({
      where: { instituteId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  // Format and unify list
  const combinedLeads: UnifiedLead[] = [
    ...directEnquiries.map((e): UnifiedLead => ({
      ...e,
      isDirectPortal: true,
      source: e.source || "ACADEMYFIND",
    })),
    ...inboundLeads.map((l): UnifiedLead => ({
      ...l,
      isDirectPortal: false,
      source: l.source,
      assignedIsm: null,
      admissionRecord: null,
      ismActivities: [],
      nextFollowUp: null,
      followUpNote: null,
      convertedToAdmission: false,
    })),
  ].sort((a: UnifiedLead, b: UnifiedLead) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Filter based on Source, Pipeline Stage, and ISM
  const filteredLeads: UnifiedLead[] = combinedLeads.filter((item: UnifiedLead) => {
    // 1. Source filter
    if (currentSource !== "ALL") {
      if (currentSource === "ACADEMYFIND" && !item.isDirectPortal) return false;
      if (currentSource !== "ACADEMYFIND" && item.source !== currentSource) return false;
    }

    // 2. Pipeline filter
    if (currentPipeline === "UNASSIGNED" && item.assignedIsmId !== null) return false;
    if (currentPipeline === "ADMISSIONS" && !item.convertedToAdmission) return false;
    if (currentPipeline === "FOLLOW_UP" && item.status !== "FOLLOW_UP") return false;
    if (currentPipeline === "OVERDUE") {
      if (!item.nextFollowUp || new Date(item.nextFollowUp) >= now || item.convertedToAdmission) {
        return false;
      }
    }
    if (currentPipeline === "TODAY") {
      if (!item.nextFollowUp) return false;
      const d = new Date(item.nextFollowUp);
      if (d < startOfToday || d > endOfToday) return false;
    }

    // 3. ISM filter
    if (currentIsm !== "ALL") {
      if (currentIsm === "UNASSIGNED" && item.assignedIsmId !== null) return false;
      if (currentIsm !== "UNASSIGNED" && item.assignedIsmId !== currentIsm) return false;
    }

    return true;
  });

  const totalCount = directCount + metaCount + googleCount + websiteCount + zapierCount;

  const sourceTabs: SourceTab[] = [
    { id: "ALL", label: "All Sources", count: totalCount },
    { id: "ACADEMYFIND", label: "AcademyFind Direct", count: directCount },
    { id: "META_ADS", label: "Meta Ads", count: metaCount },
    { id: "GOOGLE_ADS", label: "Google Ads", count: googleCount },
    { id: "WEBSITE_WEBHOOK", label: "Website Forms", count: websiteCount },
    { id: "ZAPIER", label: "Zapier / External", count: zapierCount },
  ];

  const pipelineFilters: PipelineFilter[] = [
    { id: "ALL", label: "All Stages", count: totalCount },
    { id: "UNASSIGNED", label: "Needs Assignment", count: unassignedCount },
    { id: "FOLLOW_UP", label: "In Follow-up", count: followUpCount },
    { id: "TODAY", label: "Due Today", count: followUpTodayCount },
    { id: "OVERDUE", label: "Overdue", count: overdueCount, alert: overdueCount > 0 },
    { id: "ADMISSIONS", label: "🎓 Admissions", count: admissionsCount },
  ];

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "META_ADS":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-0.5 rounded-full font-bold">
            <SiMeta className="w-3 h-3 text-[#0866FF]" /> Meta Ads
          </span>
        );
      case "GOOGLE_ADS":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-0.5 rounded-full font-bold">
            <SiGoogle className="w-3 h-3 text-[#EA4335]" /> Google Ads
          </span>
        );
      case "WEBSITE_WEBHOOK":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full font-bold">
            <Globe className="w-3 h-3 text-emerald-600" /> Website Form
          </span>
        );
      case "ZAPIER":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-orange-50 text-orange-700 border border-orange-200/80 px-2.5 py-0.5 rounded-full font-bold">
            <SiZapier className="w-3 h-3 text-[#FF4A00]" /> Zapier / External
          </span>
        );
      case "ACADEMYFIND":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-stone-100 text-stone-700 border border-stone-200/80 px-2.5 py-0.5 rounded-full font-bold">
            <Globe className="w-3 h-3 text-stone-500" /> AcademyFind
          </span>
        );
    }
  };

  function buildFilterUrl(paramsObj: { source?: string; pipeline?: string; ism?: string }) {
    const s = paramsObj.source !== undefined ? paramsObj.source : currentSource;
    const p = paramsObj.pipeline !== undefined ? paramsObj.pipeline : currentPipeline;
    const i = paramsObj.ism !== undefined ? paramsObj.ism : currentIsm;

    const parts = [];
    if (s && s !== "ALL") parts.push(`source=${s}`);
    if (p && p !== "ALL") parts.push(`pipeline=${p}`);
    if (i && i !== "ALL") parts.push(`ism=${i}`);

    return `/manager/${instituteId}/leads${parts.length > 0 ? `?${parts.join("&")}` : ""}`;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-stone-800" /> Student Leads CRM
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            Track real-time lead progress, ISM follow-ups, calls, notes, and admission conversions for{" "}
            <strong>{institute.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href={`/manager/${instituteId}/sales-team`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition"
          >
            <UserCheck className="w-3.5 h-3.5" /> Sales Team ({activeIsms.length})
          </Link>
          <Link
            href={`/manager/${instituteId}/admissions`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
          >
            <GraduationCap className="w-3.5 h-3.5" /> Admissions ({admissionsCount})
          </Link>
          <Link
            href={`/manager/${instituteId}/integrations`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" /> Integrations
          </Link>
        </div>
      </div>

      {/* 🚀 CRM KPI Metric Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Link
          href={buildFilterUrl({ pipeline: "ALL" })}
          className={`p-4 rounded-2xl border transition-all ${currentPipeline === "ALL"
            ? "bg-stone-900 text-white border-stone-900 shadow-sm"
            : "bg-white border-stone-200 hover:border-stone-400 text-stone-900"
            }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${currentPipeline === "ALL" ? "text-stone-300" : "text-stone-400"}`}>
            Total Leads
          </span>
          <span className="text-2xl font-black mt-1 block">{totalCount}</span>
          <span className={`text-[11px] mt-1 block ${currentPipeline === "ALL" ? "text-stone-300" : "text-stone-500"}`}>
            All sources
          </span>
        </Link>

        <Link
          href={buildFilterUrl({ pipeline: "UNASSIGNED" })}
          className={`p-4 rounded-2xl border transition-all ${currentPipeline === "UNASSIGNED"
            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
            : unassignedCount > 0
              ? "bg-amber-50/70 border-amber-200 hover:border-amber-300 text-amber-950"
              : "bg-white border-stone-200 hover:border-stone-400 text-stone-900"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${currentPipeline === "UNASSIGNED" ? "text-amber-100" : "text-amber-700"}`}>
              Needs ISM
            </span>
            {unassignedCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </div>
          <span className="text-2xl font-black mt-1 block">{unassignedCount}</span>
          <span className={`text-[11px] mt-1 block ${currentPipeline === "UNASSIGNED" ? "text-amber-100" : "text-amber-700"}`}>
            Unassigned leads
          </span>
        </Link>

        <Link
          href={buildFilterUrl({ pipeline: "FOLLOW_UP" })}
          className={`p-4 rounded-2xl border transition-all ${currentPipeline === "FOLLOW_UP"
            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
            : "bg-white border-stone-200 hover:border-stone-400 text-stone-900"
            }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${currentPipeline === "FOLLOW_UP" ? "text-violet-200" : "text-slate-400"}`}>
            In Follow-Up
          </span>
          <span className="text-2xl font-black mt-1 block text-violet-700">{followUpCount}</span>
          <span className={`text-[11px] mt-1 block ${currentPipeline === "FOLLOW_UP" ? "text-violet-200" : "text-slate-500"}`}>
            Active conversations
          </span>
        </Link>

        <Link
          href={buildFilterUrl({ pipeline: "OVERDUE" })}
          className={`p-4 rounded-2xl border transition-all ${currentPipeline === "OVERDUE"
            ? "bg-rose-600 text-white border-rose-600 shadow-sm"
            : overdueCount > 0
              ? "bg-rose-50 border-rose-200 hover:border-rose-300 text-rose-950"
              : "bg-white border-stone-200 hover:border-stone-400 text-stone-900"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${currentPipeline === "OVERDUE" ? "text-rose-100" : "text-rose-700"}`}>
              Overdue Follow-ups
            </span>
            {overdueCount > 0 && <AlertTriangle className={`w-3.5 h-3.5 ${currentPipeline === "OVERDUE" ? "text-white" : "text-rose-600"}`} />}
          </div>
          <span className={`text-2xl font-black mt-1 block ${currentPipeline === "OVERDUE" ? "text-white" : "text-rose-700"}`}>{overdueCount}</span>
          <span className={`text-[11px] mt-1 block ${currentPipeline === "OVERDUE" ? "text-rose-100" : "text-rose-700"}`}>
            Missed schedule
          </span>
        </Link>

        <Link
          href={buildFilterUrl({ pipeline: "ADMISSIONS" })}
          className={`p-4 rounded-2xl border transition-all col-span-2 sm:col-span-1 ${currentPipeline === "ADMISSIONS"
            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
            : "bg-white border-stone-200 hover:border-stone-400 text-stone-900"
            }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${currentPipeline === "ADMISSIONS" ? "text-emerald-100" : "text-emerald-700"}`}>
            Admissions Converted
          </span>
          <span className="text-2xl font-black mt-1 block text-emerald-700">{admissionsCount}</span>
          <span className={`text-[11px] mt-1 block ${currentPipeline === "ADMISSIONS" ? "text-emerald-100" : "text-emerald-600"}`}>
            Students enrolled
          </span>
        </Link>
      </div>

      {/* 🚀 Filter Bars: Pipeline Stages + Assigned ISM Selector + Sources */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-4">
        {/* Row 1: Pipeline Stage Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Stage:
            </span>
            {pipelineFilters.map((tab: any) => {
              const isActive = currentPipeline === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={buildFilterUrl({ pipeline: tab.id })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isActive
                    ? "bg-stone-900 text-white shadow-xs"
                    : tab.alert
                      ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isActive ? "bg-white/20 text-white" : "bg-white text-stone-700 shadow-2xs"
                      }`}
                  >
                    {tab.count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Filter by ISM Dropdown */}
          {activeIsms.length > 0 && (
            <IsmFilterSelect currentIsm={currentIsm} activeIsms={activeIsms} />
          )}
        </div>

        {/* Row 2: Source Tabs */}
        <div className="pt-3 border-t border-stone-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mr-1 shrink-0">Source:</span>
          {sourceTabs.map((tab: SourceTab) => {
            const isActive = currentSource === tab.id;
            return (
              <Link
                key={tab.id}
                href={buildFilterUrl({ source: tab.id })}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${isActive
                  ? "bg-violet-100 text-violet-800 font-bold border border-violet-200"
                  : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-100"
                  }`}
              >
                <span>{tab.label}</span> ({tab.count})
              </Link>
            );
          })}
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-stone-200 rounded-3xl bg-white shadow-2xs">
          <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h4 className="font-bold text-stone-800 text-base">No enquiries found</h4>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            No leads match the selected stage and source filters. Try clearing your filters to view all leads.
          </p>
          <Link
            href={`/manager/${instituteId}/leads`}
            className="inline-block mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
          >
            Clear all filters →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredLeads.map((enquiry: UnifiedLead) => {
            const cleanPhone = (enquiry.phone || "").replace(/[^\d]/g, "");
            const waNumber = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

            // Follow-up status check
            const followUpDate = enquiry.nextFollowUp ? new Date(enquiry.nextFollowUp) : null;
            const isOverdue = followUpDate && followUpDate < now && !enquiry.convertedToAdmission;
            const isToday = followUpDate && followUpDate >= startOfToday && followUpDate <= endOfToday;

            // Latest Activity preview
            const latestActivity = enquiry.ismActivities?.[0];

            return (
              <div
                key={enquiry.id}
                className={`p-6 border rounded-3xl shadow-xs bg-white transition-all hover:border-stone-400 ${enquiry.convertedToAdmission
                  ? "border-emerald-200 bg-emerald-50/10"
                  : isOverdue
                    ? "border-rose-200/80 bg-rose-50/20"
                    : enquiry.parentId
                      ? "border-amber-200"
                      : "border-stone-200"
                  }`}
              >
                {/* 1. Top Header: Student info + Status Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Link
                        href={`/manager/${instituteId}/leads/${enquiry.id}`}
                        className="font-extrabold text-base text-stone-900 hover:text-violet-700 hover:underline transition-colors"
                      >
                        {enquiry.name}
                      </Link>
                      {getSourceBadge(enquiry.source)}
                      {enquiry.convertedToAdmission && (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          Admission Converted
                        </span>
                      )}
                      {enquiry.parentId && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold tracking-wider">
                          <Repeat className="w-3 h-3" /> Forwarded Lead
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="inline-block text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Stage: {enquiry.status}
                      </span>
                      {enquiry.email && <span className="text-stone-500 font-medium">{enquiry.email}</span>}
                    </div>
                  </div>

                  {/* Date & View Details Link */}
                  <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0">
                    <div className="text-xs text-stone-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatIST(enquiry.createdAt, "PPp")}
                    </div>
                    <Link
                      href={`/manager/${instituteId}/leads/${enquiry.id}`}
                      className="text-xs font-bold text-violet-700 hover:text-violet-900 flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3.5 py-1.5 rounded-xl transition shadow-2xs"
                    >
                      View Lead Details <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* 2. Admission Details Card (if converted) */}
                {enquiry.convertedToAdmission && enquiry.admissionRecord && (
                  <div className="mb-3.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-emerald-950 text-sm block">
                          Enrolled: {enquiry.admissionRecord.courseName || "General Course"}
                        </span>
                        <span className="text-emerald-700 text-[11px]">
                          Total Fee: <strong>₹{enquiry.admissionRecord.totalFee.toLocaleString("en-IN")}</strong> | Paid:{" "}
                          <strong>₹{enquiry.admissionRecord.paidAmount.toLocaleString("en-IN")}</strong>
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/manager/${instituteId}/admissions`}
                      className="px-3 py-1 bg-white text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs hover:bg-emerald-100/50 transition"
                    >
                      View in Admissions Hub →
                    </Link>
                  </div>
                )}

                {/* 3. Follow-up Banner (Overdue / Today / Upcoming) */}
                {enquiry.nextFollowUp && !enquiry.convertedToAdmission && (
                  <div
                    className={`mb-3 p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${isOverdue
                      ? "bg-rose-50 border-rose-200 text-rose-950"
                      : isToday
                        ? "bg-amber-50 border-amber-200 text-amber-950"
                        : "bg-blue-50/70 border-blue-200 text-blue-950"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock
                        className={`w-4 h-4 ${isOverdue ? "text-rose-600" : isToday ? "text-amber-600" : "text-blue-600"
                          }`}
                      />
                      <div>
                        <span className="font-bold block">
                          {isOverdue
                            ? "⚠️ Follow-up Overdue!"
                            : isToday
                              ? "🔔 Follow-up Due Today!"
                              : "📅 Scheduled Follow-up"}
                        </span>
                        <span className="text-[11px] opacity-90">
                          {formatIST(enquiry.nextFollowUp, "PPP 'at' p")}
                        </span>
                      </div>
                    </div>
                    {enquiry.followUpNote && (
                      <span className="text-xs italic bg-white/70 px-2.5 py-1 rounded-xl border border-current/10 max-w-sm truncate">
                        "{enquiry.followUpNote}"
                      </span>
                    )}
                  </div>
                )}

                {/* 4. ISM Activity Logs Section */}
                {enquiry.ismActivities && enquiry.ismActivities.length > 0 ? (
                  <div className="mb-3.5 space-y-2">
                    {enquiry.ismActivities.map((act: LeadActivityItem) => {
                      const isCall = act.type === "CALL_LOGGED" || act.type === "CALL";
                      const isFollowUp = act.type === "FOLLOWUP_SET" || act.type === "FOLLOW_UP";
                      const isStatus = act.type === "STATUS_CHANGED";
                      const isConverted = act.type === "CONVERTED";
                      const isWa = act.type === "WHATSAPP_SENT" || act.type === "WHATSAPP";
                      const ismName = act.ism?.name || act.ism?.email || "Sales Manager";

                      return (
                        <div
                          key={act.id}
                          className="text-xs bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl flex items-center justify-between gap-3 text-slate-700 hover:bg-slate-100/70 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1 bg-white rounded-lg shadow-2xs shrink-0">
                              {isCall ? (
                                <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                              ) : isFollowUp ? (
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                              ) : isConverted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : isWa ? (
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              ) : isStatus ? (
                                <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-violet-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">
                                {isCall ? "📞 Call Logged" : isFollowUp ? "📅 Follow-up Set" : isStatus ? "📌 Status Changed" : isConverted ? "🎓 Admission" : "📝 Note"}:{" "}
                                <span className="font-normal text-slate-700">{act.content || act.type}</span>
                              </span>
                              <span className="text-[10px] text-slate-400">by {ismName}</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                            {formatIST(act.createdAt, "PPp")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : enquiry.assignedIsm ? (
                  <div className="mb-3 text-xs bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-xl flex items-center gap-2 text-amber-800">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Assigned to <strong>{enquiry.assignedIsm.name || enquiry.assignedIsm.email}</strong> • Awaiting first call/update</span>
                  </div>
                ) : null}

                {/* 5. Student Query Note */}
                <p className="text-xs text-stone-700 bg-stone-50 border border-stone-100 p-3 rounded-xl mb-4 italic line-clamp-2">
                  "{enquiry.message || "No message provided. Student requested a callback."}"
                </p>

                {/* 6. Contact Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {enquiry.phone && (
                    <a
                      href={`tel:${enquiry.phone}`}
                      className="inline-flex items-center gap-1.5 font-bold text-stone-700 hover:text-stone-950 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-stone-600" /> {enquiry.phone}
                    </a>
                  )}

                  {cleanPhone.length >= 10 && (
                    <a
                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
                        `Hello ${enquiry.name}, thank you for reaching out to ${institute.name}. How can we help you with your course admission?`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                    </a>
                  )}

                  <Link
                    href={`/manager/${instituteId}/leads/${enquiry.id}`}
                    className="inline-flex items-center gap-1.5 font-bold text-stone-700 hover:text-stone-900 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl transition sm:ml-auto"
                  >
                    <FileText className="w-3.5 h-3.5 text-stone-500" /> Activity History & Notes →
                  </Link>
                </div>

                {/* 7. ISM Assignment Footer */}
                {enquiry.isDirectPortal && (
                  <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-violet-500 shrink-0" />
                      <span className="text-[11px] text-stone-500 font-semibold">Assigned Sales Manager:</span>
                      <span className="font-bold text-stone-900">
                        {enquiry.assignedIsm ? enquiry.assignedIsm.name || enquiry.assignedIsm.email : "None (Unassigned)"}
                      </span>
                    </div>

                    {activeIsms.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-stone-400">Reassign:</span>
                        <IsmAssignDropdown
                          enquiryId={enquiry.id}
                          instituteId={instituteId}
                          currentIsmId={enquiry.assignedIsmId || null}
                          isms={activeIsms}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}