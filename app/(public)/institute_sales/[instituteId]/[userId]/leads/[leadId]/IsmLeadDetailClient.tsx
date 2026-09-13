"use client";

import { useState, useTransition } from "react";
import {
  Phone,
  MessageCircle,
  ClipboardList,
  CalendarClock,
  GraduationCap,
  CheckCircle2,
  Loader2,
  PlusCircle,
  X,
} from "lucide-react";
import {
  updateIsmLeadStatus,
  scheduleIsmFollowUp,
  addIsmNote,
  logIsmCall,
  convertToAdmission,
} from "@/lib/instituteSalesManager/ismLeadActions";
import { useRouter } from "next/navigation";

const STATUSES = ["NEW", "PENDING", "MESSAGED", "CALLED", "FOLLOW_UP", "DNP", "JUNK", "APPROVED"];
const CALL_OUTCOMES = ["Answered", "DNP (Did Not Pick)", "Busy", "Wrong Number", "Callback Requested"];

interface Props {
  lead: any;
  instituteId: string;
  userId: string;
  waLogUrl: string;
}

export default function IsmLeadDetailClient({ lead, instituteId, userId, waLogUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Status update
  const [status, setStatus] = useState(lead.status);

  // Follow-up
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");

  // Note
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Call log
  const [showCallLog, setShowCallLog] = useState(false);
  const [callOutcome, setCallOutcome] = useState(CALL_OUTCOMES[0]);
  const [callNotes, setCallNotes] = useState("");

  // Admission
  const [showAdmission, setShowAdmission] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [totalFee, setTotalFee] = useState("");
  const [admissionNote, setAdmissionNote] = useState("");
  const [installments, setInstallments] = useState([{ amount: "", dueDate: "", note: "" }]);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      const res = await updateIsmLeadStatus(lead.id, newStatus);
      if (res.success) {
        showFeedback("success", "Status updated!");
        router.refresh();
      } else {
        showFeedback("error", res.error || "Failed");
        setStatus(lead.status);
      }
    });
  }

  async function handleFollowUp() {
    if (!followUpDate) return showFeedback("error", "Please select a date.");
    startTransition(async () => {
      const res = await scheduleIsmFollowUp(lead.id, followUpDate, followUpNote);
      if (res.success) {
        showFeedback("success", "Follow-up scheduled!");
        setShowFollowUp(false);
        setFollowUpDate("");
        setFollowUpNote("");
        router.refresh();
      } else showFeedback("error", res.error || "Failed");
    });
  }

  async function handleNote() {
    if (!noteText.trim()) return showFeedback("error", "Note is empty.");
    startTransition(async () => {
      const res = await addIsmNote(lead.id, noteText);
      if (res.success) {
        showFeedback("success", "Note added!");
        setShowNote(false);
        setNoteText("");
        router.refresh();
      } else showFeedback("error", res.error || "Failed");
    });
  }

  async function handleCallLog() {
    startTransition(async () => {
      const res = await logIsmCall(lead.id, callOutcome, callNotes);
      if (res.success) {
        showFeedback("success", "Call logged!");
        setShowCallLog(false);
        setCallNotes("");
        router.refresh();
      } else showFeedback("error", res.error || "Failed");
    });
  }

  async function handleConvert() {
    if (!totalFee || isNaN(Number(totalFee))) return showFeedback("error", "Enter a valid total fee.");
    const insts = installments.filter((i) => i.amount && i.dueDate);
    startTransition(async () => {
      const res = await convertToAdmission(lead.id, {
        courseName,
        totalFee: Number(totalFee),
        admissionNote,
        installments: insts.map((i) => ({ amount: Number(i.amount), dueDate: i.dueDate, note: i.note })),
      });
      if (res.success) {
        showFeedback("success", "🎉 Lead converted to admission!");
        setShowAdmission(false);
        router.refresh();
      } else showFeedback("error", res.error || "Failed");
    });
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "NEW": case "PENDING": return "bg-amber-100 text-amber-800";
      case "CALLED": return "bg-emerald-100 text-emerald-700";
      case "MESSAGED": return "bg-purple-100 text-purple-700";
      case "FOLLOW_UP": return "bg-orange-100 text-orange-700";
      case "APPROVED": return "bg-green-100 text-green-700";
      case "JUNK": case "DNP": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold transition-all animate-in slide-in-from-top-2 ${feedback.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Contact Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Contact Actions</h3>
        <div className="flex flex-wrap gap-3">
          {/* WhatsApp — auto-logs via API */}
          <a
            href={waLogUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-bold transition"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" /> Send WhatsApp
          </a>

          {/* Call */}
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-sm font-bold transition"
          >
            <Phone className="w-4 h-4 text-blue-600" /> Call {lead.phone}
          </a>

          {/* Log Call */}
          <button
            onClick={() => setShowCallLog(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold transition"
          >
            <ClipboardList className="w-4 h-4" /> Log Call
          </button>
        </div>
      </div>

      {/* Status Update */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Update Lead Status</h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={isPending}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                status === s
                  ? `${statusColor(s)} border-current scale-105 shadow-sm`
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Follow-up */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-orange-500" /> Schedule Follow-up
          </h3>
          <button onClick={() => setShowFollowUp(!showFollowUp)} className="text-xs text-violet-600 font-bold hover:underline">
            {showFollowUp ? "Cancel" : lead.nextFollowUp ? "Reschedule" : "+ Schedule"}
          </button>
        </div>

        {lead.nextFollowUp && !showFollowUp && (
          <div className="text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 font-semibold">
            📅 Scheduled: {new Date(lead.nextFollowUp).toLocaleString("en-IN")}
            {lead.followUpNote && <p className="text-xs text-orange-600 mt-0.5 font-normal">{lead.followUpNote}</p>}
          </div>
        )}

        {showFollowUp && (
          <div className="space-y-3">
            <input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <input
              type="text"
              placeholder="Follow-up note (optional)"
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={handleFollowUp}
              disabled={isPending}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold transition flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              Save Follow-up
            </button>
          </div>
        )}
      </div>

      {/* Add Note */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Add Remark</h3>
          <button onClick={() => setShowNote(!showNote)} className="text-xs text-violet-600 font-bold hover:underline">
            {showNote ? "Cancel" : "+ Add Remark"}
          </button>
        </div>
        {lead.ismNote && !showNote && (
          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 italic">
            "{lead.ismNote}"
          </p>
        )}
        {showNote && (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add your note or remark about this lead..."
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
            <button
              onClick={handleNote}
              disabled={isPending}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Save Remark
            </button>
          </div>
        )}
      </div>

      {/* Convert to Admission */}
      {!lead.convertedToAdmission && (
        <div className="bg-white border border-green-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-green-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Convert to Admission
            </h3>
            <button onClick={() => setShowAdmission(!showAdmission)} className="text-xs text-green-700 font-bold hover:underline">
              {showAdmission ? "Cancel" : "🎉 Convert Now"}
            </button>
          </div>

          {showAdmission && (
            <div className="space-y-4 pt-2 border-t border-green-100">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Course / Program name"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <input
                  type="number"
                  placeholder="Total Fee (₹)"
                  value={totalFee}
                  onChange={(e) => setTotalFee(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Admission notes (optional)"
                value={admissionNote}
                onChange={(e) => setAdmissionNote(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              />

              {/* Installments */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fee Installments</p>
                {installments.map((inst, idx) => (
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
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <input
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => {
                        const updated = [...installments];
                        updated[idx].dueDate = e.target.value;
                        setInstallments(updated);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    {installments.length > 1 && (
                      <button onClick={() => setInstallments(installments.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setInstallments([...installments, { amount: "", dueDate: "", note: "" }])}
                  className="text-xs text-green-700 font-bold flex items-center gap-1 hover:underline"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Installment
                </button>
              </div>

              <button
                onClick={handleConvert}
                disabled={isPending}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Admission & Save Fee Details
              </button>
            </div>
          )}
        </div>
      )}

      {lead.convertedToAdmission && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-green-600 shrink-0" />
          <div>
            <p className="font-extrabold text-green-800">Already Converted to Admission 🎉</p>
            <p className="text-sm text-green-600 mt-0.5">Fee details and installments are tracked in the Admissions section.</p>
          </div>
        </div>
      )}

      {/* Call Log Modal */}
      {showCallLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800">Log Call</h3>
              <button onClick={() => setShowCallLog(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Call Outcome</label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="What was discussed?"
                  className="w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                />
              </div>
              <button
                onClick={handleCallLog}
                disabled={isPending}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                Save Call Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
