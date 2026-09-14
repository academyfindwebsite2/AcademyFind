"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  Mail,
  ExternalLink,
  Loader2,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import {
  getCommunicationTemplates,
  logLeadEmailInitiated,
  type CommTemplate,
} from "@/lib/crm/communicationActions";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enquiryId: string;
  instituteId: string;
  instituteName: string;
  leadName: string;
  leadEmail?: string | null;
  leadCourse?: string | null;
}

export default function EmailComposerModal({
  isOpen,
  onClose,
  enquiryId,
  instituteId,
  instituteName,
  leadName,
  leadEmail,
  leadCourse,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setCopied(false);
      setLoadingTemplates(true);
      getCommunicationTemplates(instituteId, "EMAIL")
        .then((res) => {
          setTemplates(res);
          if (res.length > 0) {
            applyTemplate(res[0]);
            setSelectedTemplateId(res[0].id);
          }
        })
        .finally(() => setLoadingTemplates(false));
    }
  }, [isOpen, instituteId]);

  if (!isOpen) return null;

  function stripHtmlTags(str: string): string {
    return str
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<li>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();
  }

  function applyTemplate(t: CommTemplate) {
    let sub = t.subject || `Enquiry update from ${instituteName}`;
    sub = sub.replace(/{name}/g, leadName || "Student");
    sub = sub.replace(/{instituteName}/g, instituteName);
    sub = sub.replace(/{course}/g, leadCourse || "Course");
    setSubject(sub);

    let text = stripHtmlTags(t.content);
    text = text.replace(/{name}/g, leadName || "Student");
    text = text.replace(/{instituteName}/g, instituteName);
    text = text.replace(/{course}/g, leadCourse || "our courses");
    setContent(text);
  }

  function handleSelectTemplate(id: string) {
    setSelectedTemplateId(id);
    const found = templates.find((t) => t.id === id);
    if (found) applyTemplate(found);
  }

  function insertVariable(variableName: string) {
    setContent((prev) => prev + ` ${variableName} `);
  }

  function handleCopy() {
    const fullText = `Subject: ${subject}\n\n${content}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Email text copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenGmail() {
    if (!leadEmail) {
      setErrorMessage("Student has no email address on file.");
      return;
    }
    if (!subject.trim()) {
      setErrorMessage("Please enter an email subject.");
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

    // Build Gmail web compose URL
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: leadEmail,
      su: subject,
      body: content,
    });
    const gmailUrl = `https://mail.google.com/mail/?${params.toString()}`;

    // Open Gmail compose in new tab
    window.open(gmailUrl, "_blank", "noopener,noreferrer");

    // Log the event to lead activity history
    startTransition(async () => {
      await logLeadEmailInitiated(
        enquiryId,
        subject.trim(),
        selectedTemplate?.title || "Custom Email",
        "GMAIL"
      );
      toast.success("Opened in Gmail & logged in lead history!");
      onClose();
      router.refresh();
    });
  }

  function handleOpenDefaultMail() {
    if (!leadEmail) {
      setErrorMessage("Student has no email address on file.");
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

    // Build mailto URL
    const params = new URLSearchParams({
      subject,
      body: content,
    });
    const mailtoUrl = `mailto:${encodeURIComponent(leadEmail)}?${params.toString()}`;

    window.location.href = mailtoUrl;

    startTransition(async () => {
      await logLeadEmailInitiated(
        enquiryId,
        subject.trim(),
        selectedTemplate?.title || "Custom Email",
        "DEFAULT_MAIL"
      );
      toast.success("Opened email client & logged in lead history!");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">
                Compose Email to Student
              </h3>
              <p className="text-xs text-stone-500">
                To: <strong>{leadName}</strong> &lt;{leadEmail || "No email recorded"}&gt;
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

        {/* Informational Banner */}
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-200/70 text-[11px] text-stone-600 flex items-center gap-2">
          <span className="font-bold text-red-600">Gmail Direct:</span>
          <span>
            Opens in your institute Gmail so student replies come directly to your personal/institute inbox.
          </span>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!leadEmail && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium">
              ⚠️ This lead does not have an email address recorded. Please add their email to send messages.
            </div>
          )}

          {/* Template Selector */}
          <div>
            <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" /> Email Template Preset
            </label>
            {loadingTemplates ? (
              <div className="p-2 bg-stone-50 rounded-xl text-stone-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates...
              </div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-red-400 focus:outline-hidden font-medium text-stone-800"
              >
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.isCustom ? "(Custom)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject Line */}
          <div>
            <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1">
              Subject Line
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Information regarding course admission"
              className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-red-400 focus:outline-hidden font-medium text-stone-900"
            />
          </div>

          {/* Dynamic Variables Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-stone-400 font-bold mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Quick tags:
            </span>
            <button
              type="button"
              onClick={() => insertVariable("{name}")}
              className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-mono text-[10px]"
            >
              +{"{name}"}
            </button>
            <button
              type="button"
              onClick={() => insertVariable("{course}")}
              className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-mono text-[10px]"
            >
              +{"{course}"}
            </button>
            <button
              type="button"
              onClick={() => insertVariable("{instituteName}")}
              className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-mono text-[10px]"
            >
              +{"{instituteName}"}
            </button>
          </div>

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-stone-700 uppercase tracking-wider block">
                Email Message Body
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-stone-500 hover:text-stone-800 font-bold flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy Text
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={8}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your email content here..."
              className="w-full p-3 rounded-2xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-red-400 focus:outline-hidden text-stone-800 leading-relaxed text-xs resize-none"
            />
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-stone-400">
            Automatically logs "Email sent" to lead timeline
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenDefaultMail}
              disabled={isPending || !leadEmail}
              className="px-3 py-2 text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              Default Mail
            </button>

            <button
              type="button"
              onClick={handleOpenGmail}
              disabled={isPending || !leadEmail}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              Open in Gmail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
