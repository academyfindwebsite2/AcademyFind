"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  MessageCircle,
  ClipboardList,
  CalendarClock,
  PlusCircle,
  Tag,
  BookOpen,
  UserCheck,
  Send,
  Loader2,
  IndianRupee,
  FileText,
  X,
  PhoneCall,
  ArrowRight,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import {
  updateIsmLeadStatus,
  scheduleIsmFollowUp,
  addIsmNote,
  logIsmCall,
  convertToAdmission,
  markInstallmentPaid,
  updateLeadAttributes,
  type ConvertToAdmissionInput,
} from "@/lib/instituteSalesManager/ismLeadActions";
import { assignLeadToIsm } from "@/lib/instituteSalesManager/ismActions";
import { useRouter } from "next/navigation";

// Modals
import WhatsAppModal from "@/components/crm/WhatsAppModal";
import EmailComposerModal from "@/components/crm/EmailComposerModal";
import EditLeadModal from "@/components/crm/EditLeadModal";

const CORE_STATUSES = [
  "NEW",
  "MESSAGED",
  "CALLED",
  "DNP",
  "CONTACT_LATER",
  "JUNK",
  "CONVERTED",
];

const CALL_OUTCOMES = [
  "Answered",
  "DNP (Did Not Pick)",
  "Busy",
  "Wrong Number",
  "Callback Requested",
  "Disconnected",
];

const PRESET_TAGS = [
  "Hot Lead",
  "Scholarship",
  "Parent Interested",
  "Referral",
  "Walk-in Expo",
  "High Priority",
];

interface IsmUser {
  id: string;
  name: string | null;
  email: string;
}

interface InstallmentItem {
  id: string;
  amount: number;
  dueDate: string | Date;
  paidDate?: string | Date | null;
  status: string;
  note?: string | null;
}

interface AdmissionData {
  id: string;
  courseName: string | null;
  totalFee: number;
  paidAmount: number;
  feeStatus: string;
  admissionNote: string | null;
  admissionDate: string | Date;
  installments: InstallmentItem[];
}

interface ActivityItem {
  id: string;
  type: string;
  content: string | null;
  createdAt: string | Date;
  ism?: {
    name: string | null;
    email: string | null;
  } | null;
  meta?: any;
}

interface LeadData {
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
  createdAt: string | Date;
  assignedIsmId: string | null;
  assignedIsm?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
  nextFollowUp: string | Date | null;
  followUpNote: string | null;
  convertedToAdmission: boolean;
  admissionRecord?: AdmissionData | null;
  ismActivities: ActivityItem[];
}

interface Props {
  lead: LeadData;
  instituteId: string;
  instituteName: string;
  activeIsms: { user: IsmUser }[];
  backHref: string;
  canEditLead?: boolean;
}

export default function LeadDetailViewClient({
  lead,
  instituteId,
  instituteName,
  activeIsms,
  backHref,
  canEditLead = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Communication & Edit Modals
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);

  // Call Logger Modal
  const [showCallLog, setShowCallLog] = useState(false);
  const [callOutcome, setCallOutcome] = useState(CALL_OUTCOMES[0]);
  const [callNotes, setCallNotes] = useState("");

  // Follow-up Scheduler Modal
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");

  // Remark / Note state
  const [remarkText, setRemarkText] = useState("");

  // Attributes Edit State
  const [courseInput, setCourseInput] = useState(lead.course || "");
  const [batchInput, setBatchInput] = useState(lead.batch || "");
  const [tags, setTags] = useState<string[]>(lead.tags || []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [attributesDirty, setAttributesDirty] = useState(false);

  // Convert to Admission Form State
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [admCourse, setAdmCourse] = useState(lead.course || "");
  const [admTotalFee, setAdmTotalFee] = useState("");
  const [admNote, setAdmNote] = useState("");
  const [installments, setInstallments] = useState<
    { amount: string; dueDate: string; note: string }[]
  >([{ amount: "", dueDate: "", note: "" }]);

  // Feedback Toast
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  function notify(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  // Handle Status Change
  function handleStatusChange(newStatus: string) {
    if (newStatus === "CONTACT_LATER") {
      setShowFollowUp(true);
      return;
    }
    if (newStatus === "CONVERTED" && !lead.convertedToAdmission) {
      setShowAdmissionModal(true);
      return;
    }

    startTransition(async () => {
      const res = await updateIsmLeadStatus(lead.id, newStatus);
      if (res.success) {
        notify("success", `Status updated to ${newStatus}`);
        router.refresh();
      } else {
        notify("error", res.error || "Failed to update status");
      }
    });
  }

  // Handle Follow-up Save
  function handleSaveFollowUp() {
    if (!followUpDate) return notify("error", "Please select a date and time");
    startTransition(async () => {
      const res = await scheduleIsmFollowUp(lead.id, followUpDate, followUpNote);
      if (res.success) {
        notify("success", "Follow-up scheduled!");
        setShowFollowUp(false);
        setFollowUpDate("");
        setFollowUpNote("");
        router.refresh();
      } else {
        notify("error", res.error || "Failed to schedule follow-up");
      }
    });
  }

  // Handle Call Log Save
  function handleSaveCallLog() {
    startTransition(async () => {
      const res = await logIsmCall(lead.id, callOutcome, callNotes);
      if (res.success) {
        notify("success", "Call outcome logged in history!");
        setShowCallLog(false);
        setCallNotes("");
        router.refresh();
      } else {
        notify("error", res.error || "Failed to log call");
      }
    });
  }

  // Handle Add Remark
  function handleAddRemark() {
    if (!remarkText.trim()) return;
    startTransition(async () => {
      const res = await addIsmNote(lead.id, remarkText.trim());
      if (res.success) {
        notify("success", "Remark added to chronological history!");
        setRemarkText("");
        router.refresh();
      } else {
        notify("error", res.error || "Failed to add remark");
      }
    });
  }

  // Handle Save Lead Attributes (Course, Batch, Tags)
  function handleSaveAttributes() {
    startTransition(async () => {
      const res = await updateLeadAttributes(lead.id, {
        course: courseInput.trim() || null,
        batch: batchInput.trim() || null,
        tags,
      });
      if (res.success) {
        notify("success", "Lead course, batch, and tags updated!");
        setAttributesDirty(false);
        router.refresh();
      } else {
        notify("error", res.error || "Failed to update lead attributes");
      }
    });
  }

  function handleAddTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setAttributesDirty(true);
    }
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter((t: any) => t !== tag));
    setAttributesDirty(true);
  }

  // Handle Reassign ISM
  function handleReassign(ismId: string) {
    startTransition(async () => {
      await assignLeadToIsm(lead.id, ismId === "UNASSIGNED" ? null : ismId);
      notify("success", "Sales Manager assigned");
      router.refresh();
    });
  }

  // Handle Convert to Admission
  function handleConvertAdmission() {
    if (!admTotalFee || isNaN(Number(admTotalFee))) {
      return notify("error", "Please enter a valid total fee");
    }

    const validInsts = installments.filter((i: any) => i.amount && i.dueDate);

    startTransition(async () => {
      const input: ConvertToAdmissionInput = {
        courseName: admCourse || undefined,
        totalFee: Number(admTotalFee),
        admissionNote: admNote || undefined,
        installments: validInsts.map((i: any) => ({
          amount: Number(i.amount),
          dueDate: i.dueDate,
          note: i.note,
        })),
      };

      const res = await convertToAdmission(lead.id, input);
      if (res.success) {
        notify("success", "🎉 Lead successfully converted to Admission!");
        setShowAdmissionModal(false);
        router.refresh();
      } else {
        notify("error", res.error || "Failed to convert admission");
      }
    });
  }

  // Handle Mark Installment Paid
  function handleMarkPaid(installmentId: string) {
    startTransition(async () => {
      const res = await markInstallmentPaid(installmentId);
      if (res.success) {
        notify("success", "Installment marked as Paid!");
        router.refresh();
      } else {
        notify("error", res.error || "Failed to update installment");
      }
    });
  }

  const now = new Date();
  const followUpDateObj = lead.nextFollowUp ? new Date(lead.nextFollowUp) : null;
  const isOverdue = followUpDateObj && followUpDateObj < now && !lead.convertedToAdmission;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-xs font-bold text-white transition-all animate-in slide-in-from-top-3 ${feedback.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Back Button */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Lead Inbox
      </Link>

      {/* 🚀 Main Lead Header Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Top Profile Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <h1 className="text-3xl font-black text-stone-900 tracking-tight">
                {lead.name}
              </h1>
              {lead.convertedToAdmission && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full font-extrabold">
                  <GraduationCap className="w-4 h-4 text-emerald-600" /> Admission Converted
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px]">
                Source: {lead.source.replace(/_/g, " ")}
              </span>
              <span className="text-stone-400">•</span>
              <span className="text-stone-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Created: {formatIST(lead.createdAt, "PPP 'at' p")}
              </span>
            </div>
          </div>

          {/* Actions & Manager Assignment */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Edit Full Lead Details Button (Institute Manager Only) */}
            {canEditLead && (
              <button
                onClick={() => setShowEditLeadModal(true)}
                className="px-4 py-3 bg-stone-900 hover:bg-black text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                title="Edit all lead profile details"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Profile
              </button>
            )}

            {/* Manager Assignment */}
            <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-2xl flex items-center gap-3 shrink-0">
              <div className="p-2 bg-violet-100 text-violet-700 rounded-xl">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block">
                  Assigned Manager
                </span>
                {canEditLead ? (
                  <select
                    value={lead.assignedIsmId || "UNASSIGNED"}
                    onChange={(e) => handleReassign(e.target.value)}
                    disabled={isPending}
                    className="text-xs font-bold text-stone-900 bg-transparent border-none focus:outline-hidden p-0 cursor-pointer"
                  >
                    <option value="UNASSIGNED">Unassigned</option>
                    {activeIsms.map((ism: any) => (
                      <option key={ism.user.id} value={ism.user.id}>
                        {ism.user.name || ism.user.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-stone-900 block">
                    {lead.assignedIsm?.name || lead.assignedIsm?.email || "Unassigned"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 Quick Actions Bar (WhatsApp, Email, Call, Status, Follow-up) */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Quick Communication & Actions
          </h4>
          <div className="flex flex-wrap gap-2.5">
            {/* Edit Lead Button (Institute Manager Only) */}
            {canEditLead && (
              <button
                onClick={() => setShowEditLeadModal(true)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold transition flex items-center gap-2"
                title="Edit Lead Information"
              >
                <Pencil className="w-4 h-4 text-stone-600" /> Edit Details
              </button>
            )}

            {/* WhatsApp with Templates */}
            <button
              onClick={() => setShowWhatsApp(true)}
              className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-2xs"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" /> Send WhatsApp
            </button>

            {/* Email with Templates */}
            <button
              onClick={() => setShowEmail(true)}
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-2xs"
            >
              <Mail className="w-4 h-4 text-blue-600" /> Send Email
            </button>

            {/* Call Action */}
            <a
              href={`tel:${lead.phone}`}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold transition flex items-center gap-2"
            >
              <Phone className="w-4 h-4 text-stone-600" /> Call {lead.phone}
            </a>

            {/* Log Call */}
            <button
              onClick={() => setShowCallLog(true)}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-2xl text-xs font-bold transition flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4 text-stone-600" /> Log Call Outcome
            </button>

            {/* Schedule Follow-up */}
            <button
              onClick={() => setShowFollowUp(true)}
              className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-2xs"
            >
              <CalendarClock className="w-4 h-4 text-amber-600" /> Schedule Follow-up
            </button>

            {/* Convert to Admission (if not yet converted) */}
            {!lead.convertedToAdmission && (
              <button
                onClick={() => setShowAdmissionModal(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs ml-auto"
              >
                <GraduationCap className="w-4 h-4" /> Convert to Admission
              </button>
            )}
          </div>
        </div>

        {/* 🚀 Status Pipeline Selector */}
        <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            Lead Stage / Status:
          </span>
          <div className="flex flex-wrap gap-2">
            {CORE_STATUSES.map((st: any) => {
              const isCurrent = lead.status === st;
              return (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  disabled={isPending}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isCurrent
                    ? "bg-stone-900 text-white shadow-xs scale-105"
                    : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
                    }`}
                >
                  {st.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* 🚀 Follow-up Notice Banner (if scheduled) */}
        {lead.nextFollowUp && !lead.convertedToAdmission && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${isOverdue
              ? "bg-rose-50 border-rose-200 text-rose-950"
              : "bg-amber-50 border-amber-200 text-amber-950"
              }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className={`w-5 h-5 ${isOverdue ? "text-rose-600" : "text-amber-600"}`} />
              <div>
                <span className="font-extrabold text-sm block">
                  {isOverdue ? "⚠️ Follow-up Overdue!" : "📅 Follow-up Scheduled"}
                </span>
                <span className="text-xs opacity-90">
                  {formatIST(lead.nextFollowUp, "PPP 'at' p")}
                </span>
                {lead.followUpNote && (
                  <p className="text-[11px] italic mt-0.5">"{lead.followUpNote}"</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowFollowUp(true)}
              className="px-3 py-1.5 bg-white text-stone-800 border border-current/20 rounded-xl font-bold text-xs hover:bg-stone-50 transition"
            >
              Reschedule
            </button>
          </div>
        )}

        {/* 🚀 Lead Attributes: Course, Batch & Custom Tags */}
        <div className="p-5 bg-stone-50/70 border border-stone-200/80 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-violet-600" /> Course, Batch & Lead Tags
            </h4>
            {canEditLead && attributesDirty && (
              <button
                onClick={handleSaveAttributes}
                disabled={isPending}
                className="px-3.5 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition flex items-center gap-1 shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            )}
          </div>

          {canEditLead ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="font-bold text-stone-500 block mb-1">Target Course / Program</label>
                  <input
                    type="text"
                    value={courseInput}
                    onChange={(e) => {
                      setCourseInput(e.target.value);
                      setAttributesDirty(true);
                    }}
                    placeholder="e.g. JEE Main / NEET / Class 10"
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-500 block mb-1">Batch Field / Timing</label>
                  <input
                    type="text"
                    value={batchInput}
                    onChange={(e) => {
                      setBatchInput(e.target.value);
                      setAttributesDirty(true);
                    }}
                    placeholder="e.g. Evening 5-8 PM / Weekend"
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="font-bold text-stone-500 text-xs flex items-center gap-1">
                  <Tag className="w-3 h-3 text-emerald-600" /> Active Lead Tags:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t: any) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800 flex items-center gap-1.5"
                    >
                      {t}
                      <button
                        onClick={() => handleRemoveTag(t)}
                        className="text-stone-400 hover:text-rose-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span className="text-stone-400 italic text-xs">No tags added yet</span>
                  )}
                </div>

                {/* Quick Add Presets */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {PRESET_TAGS.filter((pt: any) => !tags.includes(pt)).map((pt: any) => (
                    <button
                      key={pt}
                      onClick={() => handleAddTag(pt)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-stone-200/70 hover:bg-stone-300 text-stone-700 transition cursor-pointer"
                    >
                      + {pt}
                    </button>
                  ))}
                </div>

                {/* Custom Tag Input */}
                <div className="flex gap-2 pt-1 max-w-sm">
                  <input
                    type="text"
                    placeholder="Add custom tag..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(customTagInput);
                        setCustomTagInput("");
                      }
                    }}
                    className="flex-1 p-1.5 rounded-xl border border-stone-200 bg-white text-xs focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddTag(customTagInput);
                      setCustomTagInput("");
                    }}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3 bg-white rounded-xl border border-stone-200/80">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                    Target Course / Program
                  </span>
                  <span className="font-bold text-stone-800">
                    {lead.course || "Not specified"}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-stone-200/80">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                    Batch Timing / Schedule
                  </span>
                  <span className="font-bold text-stone-800">
                    {lead.batch || "Not specified"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                  Lead Tags:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags && lead.tags.length > 0 ? (
                    lead.tags.map((t: any) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-700"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-stone-400 italic text-xs">No tags assigned</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🚀 Fees & Installment Tracking Section (if Converted) */}
        {lead.admissionRecord && (
          <div className="p-6 bg-emerald-50/60 border border-emerald-200 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-700" /> Fees & Installment Schedule
              </h4>
              <span className="px-3 py-1 bg-white text-emerald-800 font-bold text-xs rounded-full border border-emerald-200">
                Fee Status: {lead.admissionRecord.feeStatus}
              </span>
            </div>

            {/* 3 KPI Cards: Total Fee, Paid Amount, Outstanding */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-white border border-emerald-100 rounded-2xl">
                <span className="text-stone-500 font-bold block text-[10px] uppercase">Total Fee</span>
                <span className="text-xl font-black text-stone-900 block mt-0.5">
                  ₹{lead.admissionRecord.totalFee.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-3.5 bg-white border border-emerald-100 rounded-2xl">
                <span className="text-emerald-700 font-bold block text-[10px] uppercase">Paid Amount</span>
                <span className="text-xl font-black text-emerald-800 block mt-0.5">
                  ₹{lead.admissionRecord.paidAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-3.5 bg-white border border-emerald-100 rounded-2xl">
                <span className="text-rose-600 font-bold block text-[10px] uppercase">Outstanding</span>
                <span className="text-xl font-black text-rose-700 block mt-0.5">
                  ₹{Math.max(0, lead.admissionRecord.totalFee - lead.admissionRecord.paidAmount).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Installments Table */}
            <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden text-xs">
              <div className="p-3 bg-emerald-100/50 font-bold text-emerald-900 border-b border-emerald-100">
                Installment Schedule
              </div>
              <table className="w-full text-left">
                <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                  <tr>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5">Amount</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(lead.admissionRecord.installments || []).map((inst: any) => (
                    <tr key={inst.id} className="hover:bg-stone-50">
                      <td className="p-2.5 font-medium text-stone-800">
                        {formatIST(inst.dueDate, "PP")}
                      </td>
                      <td className="p-2.5 font-bold text-stone-900">
                        ₹{inst.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inst.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {inst.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        {inst.status !== "PAID" && (
                          <button
                            onClick={() => handleMarkPaid(inst.id)}
                            disabled={isPending}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                          >
                            Mark as Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 🚀 Interaction History & Chronological Audit Timeline */}
        <div className="p-6 bg-white border border-stone-200 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-stone-700" />
              Chronological Interaction & Activity History
            </h4>
            <span className="text-xs text-stone-400">
              {(lead.ismActivities || []).length} events recorded
            </span>
          </div>

          {/* Add Remark Box (Always appends; never overwrites) */}
          <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
              + Add Interaction Remark / Notes
            </label>
            <textarea
              rows={2}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="Record notes from call, parent discussion, scholarship request..."
              className="w-full p-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden text-xs resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddRemark}
                disabled={isPending || !remarkText.trim()}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 disabled:opacity-40 shadow-xs cursor-pointer"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Save Remark to Timeline
              </button>
            </div>
          </div>

          {/* Activity Timeline List */}
          <div className="space-y-2.5">
            {(lead.ismActivities || []).length === 0 ? (
              <p className="text-stone-400 italic text-xs p-4 bg-stone-50 rounded-2xl text-center">
                No activity records yet
              </p>
            ) : (
              (lead.ismActivities || []).map((act: any) => {
                const isCall = act.type === "CALL_LOGGED" || act.type === "CALL";
                const isFollowUp = act.type === "FOLLOWUP_SET" || act.type === "FOLLOW_UP";
                const isStatus = act.type === "STATUS_CHANGED";
                const isConverted = act.type === "CONVERTED";
                const isWa = act.type === "WHATSAPP_SENT" || act.type === "WHATSAPP";
                const isEmail = act.type === "EMAIL_SENT" || act.type === "AUTO_EMAIL_SENT";
                const isLeadGen = act.type === "LEAD_CREATED";

                const ismName = act.ism?.name || act.ism?.email || "Advisor";

                return (
                  <div
                    key={act.id}
                    className="p-3.5 bg-white border border-stone-200/80 rounded-2xl flex items-start justify-between gap-3 text-xs hover:border-stone-300 transition"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 bg-stone-100 text-stone-700 rounded-xl shrink-0 mt-0.5">
                        {isCall ? (
                          <PhoneCall className="w-4 h-4 text-blue-600" />
                        ) : isFollowUp ? (
                          <Clock className="w-4 h-4 text-amber-600" />
                        ) : isConverted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isWa ? (
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                        ) : isEmail ? (
                          <Mail className="w-4 h-4 text-blue-600" />
                        ) : isStatus ? (
                          <ArrowRight className="w-4 h-4 text-violet-600" />
                        ) : isLeadGen ? (
                          <PlusCircle className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <FileText className="w-4 h-4 text-stone-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-stone-900 block">
                          {act.content}
                        </span>
                        <span className="text-[11px] text-stone-400 block mt-0.5">
                          Logged by: <strong>{ismName}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-stone-400 shrink-0 font-medium">
                      {formatIST(act.createdAt, "PP p")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 🚀 Modals */}
      {/* 1. WhatsApp Modal */}
      {showWhatsApp && (
        <WhatsAppModal
          isOpen={showWhatsApp}
          onClose={() => setShowWhatsApp(false)}
          enquiryId={lead.id}
          instituteId={instituteId}
          instituteName={instituteName}
          leadName={lead.name}
          leadPhone={lead.phone}
          leadCourse={lead.course}
        />
      )}

      {/* 2. Email Composer Modal */}
      {showEmail && (
        <EmailComposerModal
          isOpen={showEmail}
          onClose={() => setShowEmail(false)}
          enquiryId={lead.id}
          instituteId={instituteId}
          instituteName={instituteName}
          leadName={lead.name}
          leadEmail={lead.email}
          leadCourse={lead.course}
        />
      )}

      {/* 2.5 Edit Lead Full Details Modal (Institute Manager Only) */}
      {canEditLead && showEditLeadModal && (
        <EditLeadModal
          isOpen={showEditLeadModal}
          onClose={() => setShowEditLeadModal(false)}
          lead={{
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            course: lead.course,
            batch: lead.batch,
            source: lead.source,
            status: lead.status,
            tags: lead.tags,
            assignedIsmId: lead.assignedIsmId,
          }}
          isms={activeIsms.map((i: any) => ({
            id: i.user.id,
            name: i.user.name,
            email: i.user.email,
          }))}
        />
      )}

      {/* 3. Call Log Outcome Modal */}
      {showCallLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-blue-600" /> Log Call Outcome
              </h4>
              <button
                onClick={() => setShowCallLog(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-600 uppercase tracking-wider block mb-1">
                  Call Outcome
                </label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 font-medium focus:bg-white focus:outline-hidden"
                >
                  {CALL_OUTCOMES.map((o: any) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-stone-600 uppercase tracking-wider block mb-1">
                  Call Discussion Notes
                </label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Key discussion points, objections, batch timings..."
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowCallLog(false)}
                className="px-3.5 py-2 text-stone-500 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCallLog}
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                Save Call Outcome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Follow-up Scheduler Modal */}
      {showFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-500" /> Schedule Follow-up
              </h4>
              <button
                onClick={() => setShowFollowUp(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-600 uppercase tracking-wider block mb-1">
                  Follow-up Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-stone-600 uppercase tracking-wider block mb-1">
                  Follow-up Agenda / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call back regarding scholarship decision"
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowFollowUp(false)}
                className="px-3.5 py-2 text-stone-500 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFollowUp}
                disabled={isPending || !followUpDate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Convert to Admission Form Modal */}
      {showAdmissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">
                    Convert Lead to Admission
                  </h3>
                  <p className="text-xs text-stone-500">
                    Record course enrollment and fee installment structure
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAdmissionModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-600 block mb-1">
                    Course / Program Name
                  </label>
                  <input
                    type="text"
                    value={admCourse}
                    onChange={(e) => setAdmCourse(e.target.value)}
                    placeholder="e.g. 2-Year JEE Classroom Program"
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">
                    Total Course Fee (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={admTotalFee}
                    onChange={(e) => setAdmTotalFee(e.target.value)}
                    placeholder="e.g. 60000"
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-600 block mb-1">
                  Admission Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={admNote}
                  onChange={(e) => setAdmNote(e.target.value)}
                  placeholder="Scholarship applied, registration receipt number, etc."
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden resize-none"
                />
              </div>

              {/* Installments Schedule */}
              <div className="space-y-2.5 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                    Installment Breakdown (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setInstallments([
                        ...installments,
                        { amount: "", dueDate: "", note: "" },
                      ])
                    }
                    className="text-emerald-700 font-bold text-xs flex items-center gap-1 hover:underline"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> + Add Installment
                  </button>
                </div>

                {installments.map((inst: any, idx: any) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={inst.amount}
                      onChange={(e) => {
                        const updated = [...installments];
                        updated[idx].amount = e.target.value;
                        setInstallments(updated);
                      }}
                      className="flex-1 p-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:bg-white focus:outline-hidden"
                    />
                    <input
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => {
                        const updated = [...installments];
                        updated[idx].dueDate = e.target.value;
                        setInstallments(updated);
                      }}
                      className="flex-1 p-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:bg-white focus:outline-hidden"
                    />
                    {installments.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setInstallments(installments.filter((_: any, i: any) => i !== idx))
                        }
                        className="text-stone-400 hover:text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdmissionModal(false)}
                className="px-3.5 py-2 text-stone-500 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertAdmission}
                disabled={isPending || !admTotalFee}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
                Confirm Admission & Save Fees
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
