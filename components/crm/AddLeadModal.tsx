"use client";

import { useState, useTransition } from "react";
import {
  X,
  UserPlus,
  Phone,
  Mail,
  BookOpen,
  Calendar,
  Users,
  Tag,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { createManualLeadAction } from "@/lib/crm/crmLeadService";
import { useRouter } from "next/navigation";

interface IsmUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  instituteId: string;
  isOpen: boolean;
  onClose: () => void;
  isms: { user: IsmUser }[];
}

const PRESET_TAGS = [
  "Hot Lead",
  "Scholarship",
  "Parent Interested",
  "Referral",
  "Walk-in Expo",
  "High Priority",
];

const SOURCES = [
  { value: "PHONE_WALK_IN", label: "Phone Call / Enquiry" },
  { value: "WALK_IN", label: "Walk-in Center Visit" },
  { value: "WEBSITE", label: "Website Form" },
  { value: "ACADEMYFIND", label: "AcademyFind Portal" },
  { value: "META_ADS", label: "Facebook / Instagram" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "REFERRAL", label: "Student / Parent Referral" },
  { value: "OTHER", label: "Other / Offline" },
];

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "MESSAGED", label: "Messaged" },
  { value: "CALLED", label: "Called" },
  { value: "DNP", label: "DNP (Did Not Pick)" },
  { value: "CONTACT_LATER", label: "Contact Later" },
  { value: "JUNK", label: "Junk" },
  { value: "CONVERTED", label: "Converted" },
];

export default function AddLeadModal({
  instituteId,
  isOpen,
  onClose,
  isms,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [batch, setBatch] = useState("");
  const [source, setSource] = useState("PHONE_WALK_IN");
  const [status, setStatus] = useState("NEW");
  const [assignedIsmId, setAssignedIsmId] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  function togglePresetTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t: any) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }

  function handleAddCustomTag() {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setCustomTag("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (!name.trim()) return setErrorMessage("Please enter student name.");
    if (!cleanPhone || cleanPhone.length < 10) {
      return setErrorMessage("Please enter a valid 10-digit phone number.");
    }

    startTransition(async () => {
      const res = await createManualLeadAction({
        instituteId,
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || null,
        course: course.trim() || null,
        batch: batch.trim() || null,
        source,
        status,
        tags: selectedTags,
        assignedIsmId: assignedIsmId || null,
        message: notes.trim() || null,
      });

      if (res.success) {
        onClose();
        setName("");
        setPhone("");
        setEmail("");
        setCourse("");
        setBatch("");
        setSelectedTags([]);
        setNotes("");
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to create lead");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 text-violet-700 rounded-2xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-lg">
                Add New Student Lead
              </h3>
              <p className="text-xs text-stone-500">
                Capture offline walk-ins, phone enquiries, or direct applications
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Student Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                Student Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs pl-8 p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Email Address (Optional)
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs pl-8 p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
              />
            </div>
          </div>

          {/* Course & Batch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                Course / Program
              </label>
              <div className="relative">
                <BookOpen className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. JEE Main / NEET / Class 10"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full text-xs pl-8 p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                Batch Timing / Field
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Evening Batch (5-7 PM)"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full text-xs pl-8 p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Source & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                Lead Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
              >
                {SOURCES.map((s: any) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
              >
                {STATUSES.map((st: any) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign to Sales Manager */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-violet-600" /> Assign to Sales Manager
            </label>
            <select
              value={assignedIsmId}
              onChange={(e) => setAssignedIsmId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition"
            >
              <option value="">Leave Unassigned</option>
              {isms.map((ism: any) => (
                <option key={ism.user.id} value={ism.user.id}>
                  {ism.user.name || ism.user.email}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-emerald-600" /> Lead Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_TAGS.map((t: any) => {
                const isSelected = selectedTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => togglePresetTag(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${isSelected
                      ? "bg-stone-900 text-white shadow-2xs"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                  >
                    {t} {isSelected && "✓"}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom tag (e.g. VIP, Parent Doctor)"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="flex-1 text-xs p-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition"
              >
                + Add Tag
              </button>
            </div>
          </div>

          {/* Query / Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Student Query / Initial Remarks
            </label>
            <textarea
              rows={2}
              placeholder="What did the student enquire about?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden transition resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-stone-500 hover:text-stone-800 font-bold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Save Lead
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
