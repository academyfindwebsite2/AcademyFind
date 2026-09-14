"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  MessageCircle,
  Mail,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  FileText,
  Check,
} from "lucide-react";
import {
  getCommunicationTemplates,
  saveCommunicationTemplate,
  deleteCommunicationTemplate,
  type CommTemplate,
} from "@/lib/crm/communicationActions";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  instituteId: string;
}

export default function ManageTemplatesModal({
  isOpen,
  onClose,
  instituteId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // Editing / Creating State
  const [editingTemplate, setEditingTemplate] = useState<{
    id?: string;
    title: string;
    type: "WHATSAPP" | "EMAIL";
    subject?: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, activeTab, instituteId]);

  if (!isOpen) return null;

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await getCommunicationTemplates(instituteId, activeTab);
      setTemplates(res);
    } finally {
      setLoading(false);
    }
  }

  function handleStartNew() {
    setEditingTemplate({
      title: "",
      type: activeTab,
      subject: activeTab === "EMAIL" ? "" : undefined,
      content: "",
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.title.trim() || !editingTemplate.content.trim()) return;

    startTransition(async () => {
      await saveCommunicationTemplate(instituteId, {
        id: editingTemplate.id,
        title: editingTemplate.title.trim(),
        type: activeTab,
        subject: editingTemplate.subject?.trim(),
        content: editingTemplate.content.trim(),
      });
      setEditingTemplate(null);
      await loadTemplates();
      router.refresh();
    });
  }

  function handleDelete(templateId: string) {
    if (!confirm("Are you sure you want to delete this custom template?")) return;
    startTransition(async () => {
      await deleteCommunicationTemplate(templateId, instituteId);
      await loadTemplates();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 text-violet-700 rounded-2xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-lg">
                Communication Templates
              </h3>
              <p className="text-xs text-stone-500">
                Manage predefined WhatsApp and Email templates for faster outreach
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

        {/* Tab Selector & Create Button */}
        <div className="px-6 pt-4 flex items-center justify-between gap-3 border-b border-stone-100">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("WHATSAPP");
                setEditingTemplate(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-1.5 transition ${activeTab === "WHATSAPP"
                  ? "border-emerald-600 text-emerald-800 bg-emerald-50/50"
                  : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp Templates
            </button>
            <button
              onClick={() => {
                setActiveTab("EMAIL");
                setEditingTemplate(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-1.5 transition ${activeTab === "EMAIL"
                  ? "border-blue-600 text-blue-800 bg-blue-50/50"
                  : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
            >
              <Mail className="w-4 h-4 text-blue-600" /> Email Templates
            </button>
          </div>

          {!editingTemplate && (
            <button
              onClick={handleStartNew}
              className="px-3.5 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition flex items-center gap-1 mb-2 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> New Template
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Editor Form */}
          {editingTemplate ? (
            <form onSubmit={handleSave} className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
                <h4 className="font-extrabold text-stone-900 text-sm">
                  {editingTemplate.id ? "Edit Template" : `New ${activeTab} Template`}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Template Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fee Quote, Intro, Demo Class Invite"
                  value={editingTemplate.title}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-400 font-medium text-xs"
                />
              </div>

              {activeTab === "EMAIL" && (
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Email Subject Line</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Course Admission Details - {instituteName}"
                    value={editingTemplate.subject || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-400 font-medium text-xs"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Message Content ({activeTab === "EMAIL" ? "HTML or Text" : "Plain Text"})
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder={
                    activeTab === "WHATSAPP"
                      ? "Hello {name}, thank you for inquiring at {instituteName} regarding {course}..."
                      : "<p>Dear {name}, here is your course brochure...</p>"
                  }
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  className="w-full p-3 rounded-xl border border-stone-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-400 font-sans text-xs resize-none"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Dynamic variables: <code>&#123;name&#125;</code>, <code>&#123;instituteName&#125;</code>, <code>&#123;course&#125;</code>
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-3 py-2 text-stone-600 hover:text-stone-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Template
                </button>
              </div>
            </form>
          ) : null}

          {/* List of Templates */}
          {loading ? (
            <div className="p-8 text-center text-stone-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="p-8 text-center text-stone-400 italic">No templates found</p>
          ) : (
            <div className="space-y-3">
              {templates.map((t: any) => (
                <div
                  key={t.id}
                  className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl flex flex-col justify-between gap-2 hover:border-stone-300 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-stone-900 text-sm">{t.title}</span>
                      {t.isCustom ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                          Custom
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-600">
                          Built-in Preset
                        </span>
                      )}
                    </div>
                    {t.isCustom && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setEditingTemplate({
                              id: t.id,
                              title: t.title,
                              type: t.type,
                              subject: t.subject || undefined,
                              content: t.content,
                            })
                          }
                          className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition"
                          title="Edit Template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {t.subject && (
                    <p className="text-xs text-stone-600 font-semibold truncate">
                      Subject: {t.subject}
                    </p>
                  )}

                  <p className="text-xs text-stone-500 bg-white p-2.5 rounded-xl border border-stone-100 line-clamp-2 font-mono">
                    {t.content.replace(/<[^>]+>/g, " ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
