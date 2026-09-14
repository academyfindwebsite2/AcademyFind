"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  UserPlus,
  FileSpreadsheet,
  FileText,
  BarChart3,
  Phone,
  MessageCircle,
  Mail,
  Calendar,
  Clock,
  AlertTriangle,
  GraduationCap,
  Users,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ChevronDown,
  Globe,
  Tag,
  CheckSquare,
  Square,
  Repeat,
  Pencil,
} from "lucide-react";
import { SiMeta, SiGoogle, SiZapier } from "react-icons/si";
import { formatIST } from "@/lib/utils";
import {
  updateIsmLeadStatus,
  bulkUpdateLeadStatus,
  scheduleIsmFollowUp,
} from "@/lib/instituteSalesManager/ismLeadActions";
import { bulkAssignLeadsToIsm } from "@/lib/instituteSalesManager/ismActions";
import { useRouter } from "next/navigation";

// Modals
import AddLeadModal from "@/components/crm/AddLeadModal";
import ExcelImportModal from "@/components/crm/ExcelImportModal";
import EditLeadModal from "@/components/crm/EditLeadModal";
import WhatsAppModal from "@/components/crm/WhatsAppModal";
import EmailComposerModal from "@/components/crm/EmailComposerModal";
import CrmReportsModal from "@/components/crm/CrmReportsModal";
import ManageTemplatesModal from "@/components/crm/ManageTemplatesModal";

export interface UnifiedLeadItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  course: string | null;
  batch: string | null;
  tags: string[];
  status: string;
  source: string;
  message: string | null;
  createdAt: string;
  assignedIsmId: string | null;
  assignedIsm?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
  nextFollowUp: string | null;
  followUpNote: string | null;
  convertedToAdmission: boolean;
  parentId?: string | null;
}

interface IsmUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  instituteId: string;
  instituteName: string;
  initialLeads: UnifiedLeadItem[];
  activeIsms: { user: IsmUser }[];
  reportsStats: any;
  canEditLead?: boolean;
}

const CORE_STATUSES = [
  "ALL",
  "NEW",
  "MESSAGED",
  "CALLED",
  "DNP",
  "CONTACT_LATER",
  "JUNK",
  "CONVERTED",
];

const SOURCES = [
  "ALL",
  "ACADEMYFIND",
  "META_ADS",
  "GOOGLE_ADS",
  "WEBSITE_WEBHOOK",
  "EXCEL_IMPORT",
  "PHONE_WALK_IN",
  "WALK_IN",
  "REFERRAL",
];

export default function LeadInboxTableClient({
  instituteId,
  instituteName,
  initialLeads,
  activeIsms,
  reportsStats,
  canEditLead = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [selectedIsm, setSelectedIsm] = useState("ALL");
  const [selectedCourse, setSelectedCourse] = useState("ALL");
  const [selectedFollowUp, setSelectedFollowUp] = useState("ALL"); // ALL, TODAY, OVERDUE, UPCOMING
  const [selectedTag, setSelectedTag] = useState("ALL");

  // Selection state for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkIsmTarget, setBulkIsmTarget] = useState("");
  const [bulkStatusTarget, setBulkStatusTarget] = useState("");

  // Modals state
  const [showAddLead, setShowAddLead] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Active Lead for WhatsApp/Email/Edit Modals
  const [activeWaLead, setActiveWaLead] = useState<UnifiedLeadItem | null>(null);
  const [activeEmailLead, setActiveEmailLead] = useState<UnifiedLeadItem | null>(null);
  const [editingLead, setEditingLead] = useState<UnifiedLeadItem | null>(null);

  // Contact Later / Follow-up quick scheduler modal
  const [scheduleModalLead, setScheduleModalLead] = useState<UnifiedLeadItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");

  // Unique courses and tags for filters
  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    initialLeads.forEach((l: any) => {
      if (l.course) set.add(l.course);
    });
    return Array.from(set);
  }, [initialLeads]);

  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    initialLeads.forEach((l: any) => {
      (l.tags || []).forEach((t: any) => set.add(t));
    });
    return Array.from(set);
  }, [initialLeads]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return initialLeads.filter((lead: any) => {
      // 1. Text Search (name, phone, email, course)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = lead.name.toLowerCase().includes(q);
        const matchesPhone = lead.phone.includes(q);
        const matchesEmail = lead.email ? lead.email.toLowerCase().includes(q) : false;
        const matchesCourse = lead.course ? lead.course.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesCourse) {
          return false;
        }
      }

      // 2. Status filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "CONVERTED" && !lead.convertedToAdmission && lead.status !== "CONVERTED") {
          return false;
        } else if (selectedStatus !== "CONVERTED" && lead.status !== selectedStatus) {
          return false;
        }
      }

      // 3. Source filter
      if (selectedSource !== "ALL" && lead.source !== selectedSource) {
        return false;
      }

      // 4. ISM filter
      if (selectedIsm === "UNASSIGNED" && lead.assignedIsmId !== null) return false;
      if (selectedIsm !== "ALL" && selectedIsm !== "UNASSIGNED" && lead.assignedIsmId !== selectedIsm) {
        return false;
      }

      // 5. Course filter
      if (selectedCourse !== "ALL" && lead.course !== selectedCourse) {
        return false;
      }

      // 6. Tag filter
      if (selectedTag !== "ALL" && !(lead.tags || []).includes(selectedTag)) {
        return false;
      }

      // 7. Follow-up filter
      if (selectedFollowUp !== "ALL") {
        if (!lead.nextFollowUp) return false;
        const fDate = new Date(lead.nextFollowUp);
        if (selectedFollowUp === "TODAY") {
          if (fDate < startOfToday || fDate > endOfToday) return false;
        } else if (selectedFollowUp === "OVERDUE") {
          if (fDate >= now || lead.convertedToAdmission) return false;
        } else if (selectedFollowUp === "UPCOMING") {
          if (fDate <= endOfToday) return false;
        }
      }

      return true;
    });
  }, [
    initialLeads,
    searchTerm,
    selectedStatus,
    selectedSource,
    selectedIsm,
    selectedCourse,
    selectedTag,
    selectedFollowUp,
  ]);

  // Bulk Selection Handlers
  const areAllFilteredSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((l: any) => selectedIds.includes(l.id));

  function toggleSelectAll() {
    if (areAllFilteredSelected) {
      const filteredIdSet = new Set(filteredLeads.map((l: any) => l.id));
      setSelectedIds(selectedIds.filter((id: any) => !filteredIdSet.has(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...filteredLeads.map((l: any) => l.id)]));
      setSelectedIds(combined);
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item: any) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  // Bulk Assignment
  function handleBulkAssign() {
    if (!bulkIsmTarget || selectedIds.length === 0) return;
    startTransition(async () => {
      await bulkAssignLeadsToIsm(selectedIds, bulkIsmTarget === "NONE" ? null : bulkIsmTarget);
      setSelectedIds([]);
      setBulkIsmTarget("");
      router.refresh();
    });
  }

  // Bulk Status Change
  function handleBulkStatus() {
    if (!bulkStatusTarget || selectedIds.length === 0) return;
    startTransition(async () => {
      await bulkUpdateLeadStatus(instituteId, selectedIds, bulkStatusTarget);
      setSelectedIds([]);
      setBulkStatusTarget("");
      router.refresh();
    });
  }

  // Quick Single Status Change
  function handleStatusChange(lead: UnifiedLeadItem, newStatus: string) {
    if (newStatus === "CONTACT_LATER") {
      setScheduleModalLead(lead);
      return;
    }
    startTransition(async () => {
      await updateIsmLeadStatus(lead.id, newStatus);
      router.refresh();
    });
  }

  // Follow-up modal submit
  function handleSaveFollowUp() {
    if (!scheduleModalLead || !scheduleDate) return;
    startTransition(async () => {
      await scheduleIsmFollowUp(scheduleModalLead.id, scheduleDate, scheduleNote);
      setScheduleModalLead(null);
      setScheduleDate("");
      setScheduleNote("");
      router.refresh();
    });
  }

  // Source Badge Helper
  const getSourceBadge = (source: string) => {
    switch (source) {
      case "META_ADS":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
            <SiMeta className="w-2.5 h-2.5 text-[#0866FF]" /> Meta Ads
          </span>
        );
      case "GOOGLE_ADS":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 border border-red-200/80 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
            <SiGoogle className="w-2.5 h-2.5 text-[#EA4335]" /> Google Ads
          </span>
        );
      case "WEBSITE_WEBHOOK":
      case "WEBSITE":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
            <Globe className="w-2.5 h-2.5 text-emerald-600" /> Website
          </span>
        );
      case "EXCEL_IMPORT":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100/70 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
            <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-700" /> Excel Import
          </span>
        );
      case "PHONE_WALK_IN":
      case "WALK_IN":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
            <Phone className="w-2.5 h-2.5 text-amber-600" /> Walk-in/Call
          </span>
        );
      case "ACADEMYFIND":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
            AcademyFind
          </span>
        );
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string, converted: boolean) => {
    if (converted || status === "CONVERTED") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-extrabold whitespace-nowrap">
          <GraduationCap className="w-3 h-3 text-emerald-600" /> Converted
        </span>
      );
    }
    switch (status) {
      case "NEW":
        return (
          <span className="inline-flex items-center text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            ● New
          </span>
        );
      case "MESSAGED":
        return (
          <span className="inline-flex items-center text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            Messaged
          </span>
        );
      case "CALLED":
        return (
          <span className="inline-flex items-center text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            Called
          </span>
        );
      case "DNP":
        return (
          <span className="inline-flex items-center text-[11px] bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            DNP
          </span>
        );
      case "CONTACT_LATER":
      case "FOLLOW_UP":
        return (
          <span className="inline-flex items-center text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            Contact Later
          </span>
        );
      case "JUNK":
        return (
          <span className="inline-flex items-center text-[11px] bg-stone-100 text-stone-500 border border-stone-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            Junk
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 🚀 Top Action Bar: Search + Primary Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            Lead Inbox
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Capture, follow up, and convert student enquiries into admissions for{" "}
            <strong>{instituteName}</strong>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Lead */}
          <button
            onClick={() => setShowAddLead(true)}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Lead
          </button>

          {/* Import Excel/CSV */}
          <button
            onClick={() => setShowExcelImport(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Import Excel / CSV
          </button>

          {/* Templates */}
          <button
            onClick={() => setShowTemplates(true)}
            className="px-3.5 py-2 bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-stone-500" /> Templates
          </button>

          {/* CRM Reports */}
          <button
            onClick={() => setShowReports(true)}
            className="px-3.5 py-2 bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
          >
            <BarChart3 className="w-3.5 h-3.5" /> CRM Reports
          </button>
        </div>
      </div>

      {/* 🚀 Combinable Filters Card */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-4 shadow-xs space-y-3">
        {/* Row 1: Search + Statuses + Follow-up shortcuts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by student name, phone, email, course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-stone-900 focus:outline-hidden transition"
            />
          </div>

          {/* Quick Follow-up Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedFollowUp("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedFollowUp === "ALL"
                ? "bg-stone-900 text-white shadow-2xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
            >
              All Leads ({initialLeads.length})
            </button>
            <button
              onClick={() => setSelectedFollowUp("TODAY")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${selectedFollowUp === "TODAY"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                }`}
            >
              <Clock className="w-3 h-3" /> Due Today
            </button>
            <button
              onClick={() => setSelectedFollowUp("OVERDUE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${selectedFollowUp === "OVERDUE"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
                }`}
            >
              <AlertTriangle className="w-3 h-3" /> Overdue
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters (Status, Source, ISM, Course, Tag) */}
        <div className="pt-2.5 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          {/* Status Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
              Status:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:bg-white focus:outline-hidden"
            >
              {CORE_STATUSES.map((st: any) => (
                <option key={st} value={st}>
                  {st === "ALL" ? "All Statuses" : st.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Source Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
              Source:
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full p-2 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:bg-white focus:outline-hidden"
            >
              {SOURCES.map((sc: any) => (
                <option key={sc} value={sc}>
                  {sc === "ALL" ? "All Sources" : sc.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Sales Manager Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
              Sales Manager:
            </label>
            <select
              value={selectedIsm}
              onChange={(e) => setSelectedIsm(e.target.value)}
              className="w-full p-2 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Managers</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {activeIsms.map((ism: any) => (
                <option key={ism.user.id} value={ism.user.id}>
                  {ism.user.name || ism.user.email}
                </option>
              ))}
            </select>
          </div>

          {/* Course Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
              Course / Program:
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full p-2 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Courses</option>
              {uniqueCourses.map((c: any) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
              Tag:
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full p-2 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Tags</option>
              {uniqueTags.map((t: any) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 🚀 Main Lead Inbox Table matching Section 8 of Product Spec */}
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs relative">
        {/* Table Header Bar / Top Bulk Action Bar */}
        {selectedIds.length > 0 ? (
          <div className="p-3.5 bg-stone-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs border-b border-stone-800 sticky top-0 z-20 shadow-md animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-extrabold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{selectedIds.length} leads selected</span>
              </div>
              <button
                onClick={() => setSelectedIds([])}
                className="text-stone-400 hover:text-white underline text-xs font-semibold transition"
              >
                Deselect All
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Bulk Assign */}
              <div className="flex items-center gap-1.5 bg-stone-800/80 p-1 rounded-xl border border-stone-700">
                <select
                  value={bulkIsmTarget}
                  onChange={(e) => setBulkIsmTarget(e.target.value)}
                  className="p-1.5 rounded-lg bg-stone-800 text-white border-0 text-xs focus:ring-1 focus:ring-violet-400 focus:outline-hidden"
                >
                  <option value="">Assign to Manager...</option>
                  <option value="NONE">Unassign</option>
                  {activeIsms.map((ism: any) => (
                    <option key={ism.user.id} value={ism.user.id}>
                      {ism.user.name || ism.user.email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={isPending || !bulkIsmTarget}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs transition disabled:opacity-40 shadow-xs"
                >
                  Assign
                </button>
              </div>

              {/* Bulk Status */}
              <div className="flex items-center gap-1.5 bg-stone-800/80 p-1 rounded-xl border border-stone-700">
                <select
                  value={bulkStatusTarget}
                  onChange={(e) => setBulkStatusTarget(e.target.value)}
                  className="p-1.5 rounded-lg bg-stone-800 text-white border-0 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden"
                >
                  <option value="">Change Status...</option>
                  {CORE_STATUSES.filter((s: any) => s !== "ALL").map((st: any) => (
                    <option key={st} value={st}>
                      {st.replace("_", " ")}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkStatus}
                  disabled={isPending || !bulkStatusTarget}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition disabled:opacity-40 shadow-xs"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-stone-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-stone-800">
                Showing {filteredLeads.length} leads
              </span>
              {(searchTerm ||
                selectedStatus !== "ALL" ||
                selectedSource !== "ALL" ||
                selectedIsm !== "ALL" ||
                selectedCourse !== "ALL" ||
                selectedFollowUp !== "ALL" ||
                selectedTag !== "ALL") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedStatus("ALL");
                      setSelectedSource("ALL");
                      setSelectedIsm("ALL");
                      setSelectedCourse("ALL");
                      setSelectedFollowUp("ALL");
                      setSelectedTag("ALL");
                    }}
                    className="text-[11px] text-violet-700 font-bold hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
            </div>
          </div>
        )}

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[10px] border-b border-stone-200/80">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-stone-400 hover:text-stone-700 transition"
                  >
                    {areAllFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-stone-900" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Lead / Contact</th>
                <th className="p-3.5">Course / Batch</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Assigned</th>
                <th className="p-3.5">Next Follow-up</th>
                <th className="p-3.5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-stone-400">
                    <p className="font-bold text-stone-600 text-sm">
                      No leads match your active filters
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      Try clearing filters or search terms to see all enquiries.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead: any) => {
                  const isSelected = selectedIds.includes(lead.id);
                  const followUpDate = lead.nextFollowUp
                    ? new Date(lead.nextFollowUp)
                    : null;
                  const isOverdue =
                    followUpDate &&
                    followUpDate < now &&
                    !lead.convertedToAdmission;
                  const isToday =
                    followUpDate &&
                    followUpDate >= startOfToday &&
                    followUpDate <= endOfToday;

                  const cleanPhone = lead.phone.replace(/[^\d]/g, "");

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-stone-50/70 transition-colors ${isSelected ? "bg-violet-50/30" : ""
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => toggleSelectOne(lead.id)}
                          className="text-stone-400 hover:text-stone-700 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-stone-900" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Lead / Contact */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/manager/${instituteId}/leads/${lead.id}`}
                            className="font-black text-stone-900 text-sm hover:text-violet-700 hover:underline transition-colors"
                          >
                            {lead.name}
                          </Link>
                          {getSourceBadge(lead.source)}
                          {lead.parentId && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                              Forwarded
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                          <span>{lead.phone}</span>
                          {lead.email && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[140px]">
                                {lead.email}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Course / Batch */}
                      <td className="p-3.5">
                        <span className="font-bold text-stone-800 block">
                          {lead.course || "General Enquiry"}
                        </span>
                        {lead.batch ? (
                          <span className="text-[11px] text-stone-500 block">
                            {lead.batch}
                          </span>
                        ) : null}
                        {lead.tags && lead.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {lead.tags.slice(0, 2).map((t: any) => (
                              <span
                                key={t}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-semibold"
                              >
                                {t}
                              </span>
                            ))}
                            {lead.tags.length > 2 && (
                              <span className="text-[9px] text-stone-400 font-bold">
                                +{lead.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <div className="relative inline-block">
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead, e.target.value)}
                            disabled={isPending}
                            className="appearance-none cursor-pointer pl-2 pr-6 py-1 rounded-full text-xs font-bold focus:outline-hidden"
                            style={{ backgroundColor: "transparent" }}
                          >
                            {CORE_STATUSES.filter((s: any) => s !== "ALL").map((st: any) => (
                              <option key={st} value={st}>
                                {st.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none">
                            {getStatusBadge(lead.status, lead.convertedToAdmission)}
                          </div>
                        </div>
                      </td>

                      {/* Assigned */}
                      <td className="p-3.5">
                        <span className="font-semibold text-stone-800 block">
                          {lead.assignedIsm?.name ||
                            lead.assignedIsm?.email || (
                              <span className="text-stone-400 font-normal italic">
                                Unassigned
                              </span>
                            )}
                        </span>
                      </td>

                      {/* Next Follow-up */}
                      <td className="p-3.5">
                        {lead.nextFollowUp ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[11px] font-bold ${isOverdue
                                  ? "text-rose-600"
                                  : isToday
                                    ? "text-amber-700"
                                    : "text-stone-700"
                                  }`}
                              >
                                {isOverdue
                                  ? "Overdue: "
                                  : isToday
                                    ? "Today "
                                    : ""}
                                {formatIST(lead.nextFollowUp, "PP p")}
                              </span>
                            </div>
                            {lead.followUpNote && (
                              <p className="text-[10px] text-stone-400 italic truncate max-w-[140px]">
                                "{lead.followUpNote}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setScheduleModalLead(lead)}
                            className="text-[11px] text-stone-400 hover:text-stone-700 font-medium hover:underline"
                          >
                            + Schedule
                          </button>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* WhatsApp */}
                          <button
                            onClick={() => setActiveWaLead(lead)}
                            title="Send WhatsApp Template"
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* Email */}
                          <button
                            onClick={() => setActiveEmailLead(lead)}
                            title="Send Email"
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {/* Call */}
                          <a
                            href={`tel:${lead.phone}`}
                            title={`Call ${lead.phone}`}
                            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                          >
                            <Phone className="w-4 h-4" />
                          </a>

                          {/* Edit Lead (Manager Only) */}
                          {canEditLead && (
                            <button
                              onClick={() => setEditingLead(lead)}
                              title="Edit Lead Details"
                              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* View Detail */}
                          <Link
                            href={`/manager/${instituteId}/leads/${lead.id}`}
                            className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                            title="View Full Lead Profile"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚀 Sticky Floating Bulk Actions Bar (Bottom Mirror) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white rounded-2xl shadow-2xl px-5 py-3 border border-stone-700/80 flex items-center gap-3.5 animate-in slide-in-from-bottom-4 text-xs max-w-[95vw] overflow-x-auto">
          <div className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{selectedIds.length} leads selected</span>
          </div>

          <div className="h-4 w-px bg-stone-700" />

          {/* Bulk Assign */}
          <div className="flex items-center gap-1.5">
            <select
              value={bulkIsmTarget}
              onChange={(e) => setBulkIsmTarget(e.target.value)}
              className="p-1.5 rounded-lg bg-stone-800 text-white border border-stone-700 text-xs focus:outline-hidden"
            >
              <option value="">Assign to Manager...</option>
              <option value="NONE">Unassign</option>
              {activeIsms.map((ism: any) => (
                <option key={ism.user.id} value={ism.user.id}>
                  {ism.user.name || ism.user.email}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={isPending || !bulkIsmTarget}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs transition disabled:opacity-40"
            >
              Assign
            </button>
          </div>

          <div className="h-4 w-px bg-stone-700" />

          {/* Bulk Status */}
          <div className="flex items-center gap-1.5">
            <select
              value={bulkStatusTarget}
              onChange={(e) => setBulkStatusTarget(e.target.value)}
              className="p-1.5 rounded-lg bg-stone-800 text-white border border-stone-700 text-xs focus:outline-hidden"
            >
              <option value="">Change Status...</option>
              {CORE_STATUSES.filter((s: any) => s !== "ALL").map((st: any) => (
                <option key={st} value={st}>
                  {st.replace("_", " ")}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkStatus}
              disabled={isPending || !bulkStatusTarget}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition disabled:opacity-40"
            >
              Update
            </button>
          </div>

          <div className="h-4 w-px bg-stone-700" />

          <button
            onClick={() => setSelectedIds([])}
            className="text-stone-400 hover:text-white font-bold text-xs"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* 🚀 Modals */}
      {/* 1. Add Lead Modal */}
      <AddLeadModal
        instituteId={instituteId}
        isOpen={showAddLead}
        onClose={() => setShowAddLead(false)}
        isms={activeIsms}
      />

      {/* 2. Excel / CSV Import Modal */}
      <ExcelImportModal
        instituteId={instituteId}
        isOpen={showExcelImport}
        onClose={() => setShowExcelImport(false)}
        isms={activeIsms}
      />

      {/* 3. WhatsApp Modal */}
      {activeWaLead && (
        <WhatsAppModal
          isOpen={!!activeWaLead}
          onClose={() => setActiveWaLead(null)}
          enquiryId={activeWaLead.id}
          instituteId={instituteId}
          instituteName={instituteName}
          leadName={activeWaLead.name}
          leadPhone={activeWaLead.phone}
          leadCourse={activeWaLead.course}
        />
      )}

      {/* 4. Email Composer Modal */}
      {activeEmailLead && (
        <EmailComposerModal
          isOpen={!!activeEmailLead}
          onClose={() => setActiveEmailLead(null)}
          enquiryId={activeEmailLead.id}
          instituteId={instituteId}
          instituteName={instituteName}
          leadName={activeEmailLead.name}
          leadEmail={activeEmailLead.email}
          leadCourse={activeEmailLead.course}
        />
      )}

      {/* 4.5 Edit Lead Modal (Institute Manager Only) */}
      {canEditLead && editingLead && (
        <EditLeadModal
          isOpen={!!editingLead}
          onClose={() => setEditingLead(null)}
          lead={editingLead}
          isms={activeIsms.map((i: any) => ({ id: i.user.id, name: i.user.name, email: i.user.email }))}
        />
      )}

      {/* 5. CRM Reports Modal */}
      <CrmReportsModal
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        instituteName={instituteName}
        stats={reportsStats}
      />

      {/* 6. Communication Templates Modal */}
      <ManageTemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        instituteId={instituteId}
      />

      {/* 7. Quick Follow-up Scheduler Modal */}
      {scheduleModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-sm p-6 space-y-4">
            <h4 className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" /> Schedule Follow-up
            </h4>
            <p className="text-xs text-stone-500">
              Set follow-up date and time for <strong>{scheduleModalLead.name}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Follow-up Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Note / Agenda
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call back to confirm fee discount"
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setScheduleModalLead(null)}
                className="px-3 py-1.5 text-stone-500 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFollowUp}
                disabled={isPending || !scheduleDate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Calendar className="w-3.5 h-3.5" />
                )}
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
