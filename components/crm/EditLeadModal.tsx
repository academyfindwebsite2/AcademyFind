"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  Pencil,
  User,
  Phone,
  Mail,
  BookOpen,
  Clock,
  Tag,
  Shield,
  Loader2,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { updateLeadFullDetails } from "@/lib/instituteSalesManager/ismLeadActions";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const CORE_STATUSES = [
  { value: "NEW", label: "New Lead" },
  { value: "MESSAGED", label: "Messaged" },
  { value: "CALLED", label: "Called" },
  { value: "DNP", label: "DNP (Did Not Pick)" },
  { value: "CONTACT_LATER", label: "Contact Later" },
  { value: "JUNK", label: "Junk / Invalid" },
  { value: "CONVERTED", label: "Converted to Admission" },
];

const LEAD_SOURCES = [
  { value: "ACADEMYFIND", label: "AcademyFind Direct" },
  { value: "META_ADS", label: "Meta (FB / Instagram) Ads" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "WALK_IN", label: "Walk-in / Offline Visit" },
  { value: "PHONE_WALK_IN", label: "Phone Call Inquiry" },
  { value: "EXCEL_IMPORT", label: "Excel / CSV Import" },
  { value: "WEBSITE_WEBHOOK", label: "Institute Website Form" },
  { value: "REFERRAL", label: "Student / Teacher Referral" },
  { value: "OTHER", label: "Other Source" },
];

interface IsmOption {
  id: string;
  name: string | null;
  email: string;
}

export interface EditableLeadData {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  course?: string | null;
  batch?: string | null;
  source: string;
  status: string;
  tags: string[];
  assignedIsmId?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: EditableLeadData;
  isms: IsmOption[];
  onLeadUpdated?: (updated: EditableLeadData) => void;
}

export default function EditLeadModal({
  isOpen,
  onClose,
  lead,
  isms,
  onLeadUpdated,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(lead.name || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [course, setCourse] = useState(lead.course || "");
  const [batch, setBatch] = useState(lead.batch || "");
  const [source, setSource] = useState(lead.source || "ACADEMYFIND");
  const [status, setStatus] = useState(lead.status || "NEW");
  const [assignedIsmId, setAssignedIsmId] = useState(lead.assignedIsmId || "");
  const [tags, setTags] = useState<string[]>(lead.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(lead.name || "");
      setPhone(lead.phone || "");
      setEmail(lead.email || "");
      setCourse(lead.course || "");
      setBatch(lead.batch || "");
      setSource(lead.source || "ACADEMYFIND");
      setStatus(lead.status || "NEW");
      setAssignedIsmId(lead.assignedIsmId || "");
      setTags(lead.tags || []);
      setTagInput("");
      setErrorMessage(null);
    }
  }, [isOpen, lead]);

  if (!isOpen) return null;

  function handleAddTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t: any) => t !== tagToRemove));
  }

  function handleKeyDownTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage("Student name is required.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid 10-digit phone number.");
      return;
    }

    startTransition(async () => {
      const res = await updateLeadFullDetails(lead.id, {
        name: cleanName,
        phone: cleanPhone,
        email: email.trim() || null,
        course: course.trim() || null,
        batch: batch.trim() || null,
        source,
        status,
        assignedIsmId: assignedIsmId || null,
        tags,
      });

      if (res.success) {
        toast.success("Lead details updated successfully!");
        if (onLeadUpdated) {
          onLeadUpdated({
            id: lead.id,
            name: cleanName,
            phone: cleanPhone,
            email: email.trim() || null,
            course: course.trim() || null,
            batch: batch.trim() || null,
            source,
            status,
            tags,
            assignedIsmId: assignedIsmId || null,
          });
        }
        onClose();
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to update lead details");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 text-violet-700 rounded-2xl">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">
                Edit Lead Profile
              </h3>
              <p className="text-xs text-stone-500">
                Updating details for <strong>{lead.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Student Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-stone-500" /> Student Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full student name"
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-900"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-500" /> Phone Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-900"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-stone-500" /> Email Address (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student.email@example.com"
              className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-900"
            />
          </div>

          {/* Course & Batch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-stone-500" /> Course of Interest
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. JEE Main, NEET, Class 10"
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-900"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" /> Batch Timing
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. Morning 8 AM, Weekend"
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-900"
              />
            </div>
          </div>

          {/* Status & Assigned Counselor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-stone-500" /> Lead Pipeline Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-bold text-stone-800"
              >
                {CORE_STATUSES.map((st: any) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1">
                Assigned Counselor / ISM
              </label>
              <select
                value={assignedIsmId}
                onChange={(e) => setAssignedIsmId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-800"
              >
                <option value="">Unassigned</option>
                {isms.map((ism: any) => (
                  <option key={ism.id} value={ism.id}>
                    {ism.name || ism.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead Source */}
          <div>
            <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1">
              Lead Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden font-medium text-stone-800"
            >
              {LEAD_SOURCES.map((s: any) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-stone-500" /> Tags / Labels
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDownTag}
                placeholder="Type tag (e.g. Scholarship, Demo Done) and press Enter"
                className="flex-1 p-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t: any) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-bold text-[11px]"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">
              Changes will be recorded in activity history
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-3.5 py-2 text-stone-600 hover:text-stone-900 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pencil className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
