"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  MessageCircle,
  Send,
  Loader2,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import {
  getCommunicationTemplates,
  logLeadWhatsAppSent,
  type CommTemplate,
} from "@/lib/crm/communicationActions";
import { formatWhatsAppNumber } from "@/lib/utils";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enquiryId: string;
  instituteId: string;
  instituteName: string;
  leadName: string;
  leadPhone: string;
  leadCourse?: string | null;
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  enquiryId,
  instituteId,
  instituteName,
  leadName,
  leadPhone,
  leadCourse,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setLoadingTemplates(true);
      getCommunicationTemplates(instituteId, "WHATSAPP")
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

  function applyTemplate(t: CommTemplate) {
    let text = t.content;
    text = text.replace(/{name}/g, leadName || "Student");
    text = text.replace(/{instituteName}/g, instituteName);
    text = text.replace(/{course}/g, leadCourse || "our courses");
    setMessage(text);
  }

  function handleSelectTemplate(id: string) {
    setSelectedTemplateId(id);
    const found = templates.find((t) => t.id === id);
    if (found) applyTemplate(found);
  }

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("WhatsApp message copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSend() {
    if (!leadPhone) return;
    const waPhone = formatWhatsAppNumber(leadPhone);
    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

    // Direct WhatsApp API URL (bypasses wa.me HTTP 302 redirect which replaces UTF-8 emojis with '?')
    const url = `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(message)}`;

    // Open immediately in user interaction thread to prevent popup blocker
    window.open(url, "_blank", "noopener,noreferrer");

    startTransition(async () => {
      // Log activity in database
      await logLeadWhatsAppSent(
        enquiryId,
        selectedTemplate?.title || "Custom WhatsApp",
        message
      );

      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">
                Send WhatsApp Message
              </h3>
              <p className="text-xs text-stone-500">
                To: <strong>{leadName}</strong> ({leadPhone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Template Selector */}
          <div>
            <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" /> Select Institute Template
            </label>
            {loadingTemplates ? (
              <div className="p-2.5 bg-stone-50 rounded-xl text-stone-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates...
              </div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-hidden font-medium text-stone-800"
              >
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.isCustom ? "(Custom)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Message preview / edit */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-stone-700 uppercase tracking-wider block">
                Message Content (Editable)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-stone-500 hover:text-stone-800 font-bold flex items-center gap-1 transition"
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
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message..."
              className="w-full p-3 rounded-2xl border border-stone-200 bg-emerald-50/20 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-hidden text-stone-800 leading-relaxed font-sans resize-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Variables like <code>&#123;name&#125;</code> and <code>&#123;course&#125;</code> have been pre-filled.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[11px] text-stone-400">
            Action will be logged in activity history
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-stone-600 hover:text-stone-900 text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !message.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send WhatsApp →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
