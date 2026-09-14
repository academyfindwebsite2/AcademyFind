"use client";

import { useState, useMemo } from "react";
import { formatIST, formatWhatsAppNumber } from "@/lib/utils";
import {
  Search,
  Phone,
  Mail,
  Filter,
  Calendar,
  Building2,
  ExternalLink,
  Code,
  CheckCircle,
  Clock,
  ChevronDown,
  X,
  User,
  Sparkles,
  MessageSquare,
  Trash2,
  Edit3,
  Save,
  Check,
} from "lucide-react";
import { SiGoogle, SiMeta, SiZapier } from "react-icons/si";
import { FaWhatsapp } from "react-icons/fa";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  updateInboundLeadStatus,
  updateInboundLeadNotes,
  deleteInboundLead,
} from "@/lib/User/admin/adminInboundLeads";

interface InboundLeadItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  source: string;
  sourceDetails: any;
  status: string;
  notes?: string | null;
  createdAt: string | Date;
  institute: {
    id: string;
    name: string;
    slug?: string | null;
    subscriptionPlan?: string | null;
    city?: { name: string } | null;
  };
  integration?: {
    id: string;
    name: string | null;
    provider: string;
  } | null;
}

interface InboundLeadsExplorerProps {
  leads: InboundLeadItem[];
  institutes: { id: string; name: string }[];
}

const CRM_STATUSES = [
  { id: "NEW", label: "New", bg: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "CALLED", label: "Called", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "MESSAGED", label: "Messaged", bg: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "FOLLOW_UP", label: "Follow Up", bg: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "CALL_BACK", label: "Call Back", bg: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "CONVERTED", label: "Converted 🚀", bg: "bg-green-100 text-green-800 border-green-200" },
  { id: "DNP", label: "DNP", bg: "bg-stone-200 text-stone-700 border-stone-300" },
  { id: "JUNK", label: "Junk", bg: "bg-red-100 text-red-800 border-red-200" },
];

export default function InboundLeadsExplorer({
  leads: initialLeads,
  institutes,
}: InboundLeadsExplorerProps) {
  const [leadsList, setLeadsList] = useState<InboundLeadItem[]>(initialLeads);
  const [selectedInstituteId, setSelectedInstituteId] = useState<string>("ALL");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Notes editing state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // Payload modal state
  const [activePayload, setActivePayload] = useState<{
    leadName: string;
    source: string;
    payload: any;
  } | null>(null);

  // Update lead status
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    // Optimistic UI update
    setLeadsList((prev: any) =>
      prev.map((l: any) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    const res = await updateInboundLeadStatus(leadId, newStatus);
    if (res.success) {
      toast.success(`Status updated to ${newStatus}`);
    } else {
      toast.error(res.error || "Failed to update status");
    }
  };

  // Save notes
  const handleSaveNotes = async (leadId: string) => {
    setIsSavingNotes(true);
    const res = await updateInboundLeadNotes(leadId, notesText);
    if (res.success) {
      setLeadsList((prev: any) =>
        prev.map((l: any) => (l.id === leadId ? { ...l, notes: notesText } : l))
      );
      toast.success("Notes saved!");
      setEditingNotesId(null);
    } else {
      toast.error(res.error || "Failed to save notes");
    }
    setIsSavingNotes(false);
  };

  // Delete lead
  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (!confirm(`Are you sure you want to delete lead "${leadName}"?`)) return;

    setLeadsList((prev: any) => prev.filter((l: any) => l.id !== leadId));
    const res = await deleteInboundLead(leadId);
    if (res.success) {
      toast.success("Lead deleted successfully!");
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const filteredLeads = useMemo(() => {
    return leadsList.filter((lead: any) => {
      // Institute filter
      if (
        selectedInstituteId !== "ALL" &&
        lead.institute.id !== selectedInstituteId
      ) {
        return false;
      }

      // Provider filter
      if (selectedProvider !== "ALL") {
        if (selectedProvider === "GOOGLE" && !lead.source.includes("GOOGLE")) {
          return false;
        }
        if (selectedProvider === "META" && !lead.source.includes("META")) {
          return false;
        }
        if (
          selectedProvider === "WEBHOOK" &&
          !lead.source.includes("WEBHOOK") &&
          lead.source !== "EXTERNAL_WEBHOOK"
        ) {
          return false;
        }
        if (selectedProvider === "ZAPIER" && !lead.source.includes("ZAPIER")) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== "ALL" && lead.status !== selectedStatus) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = lead.name.toLowerCase().includes(q);
        const matchesPhone = lead.phone.toLowerCase().includes(q);
        const matchesEmail = lead.email?.toLowerCase().includes(q);
        const matchesInst = lead.institute.name.toLowerCase().includes(q);
        const matchesMsg = lead.message?.toLowerCase().includes(q);
        const matchesNotes = lead.notes?.toLowerCase().includes(q);
        if (
          !matchesName &&
          !matchesPhone &&
          !matchesEmail &&
          !matchesInst &&
          !matchesMsg &&
          !matchesNotes
        ) {
          return false;
        }
      }

      return true;
    });
  }, [leadsList, selectedInstituteId, selectedProvider, selectedStatus, searchQuery]);

  const getSourceBadge = (source: string) => {
    if (source.includes("GOOGLE")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
          <SiGoogle className="w-3 h-3 text-[#EA4335]" /> Google Ads
        </span>
      );
    }
    if (source.includes("META")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <SiMeta className="w-3 h-3 text-[#0866FF]" /> Meta Ads
        </span>
      );
    }
    if (source.includes("ZAPIER")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
          <SiZapier className="w-3 h-3 text-[#FF4A00]" /> Zapier
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Code className="w-3 h-3 text-emerald-600" /> Custom Webhook
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    const found = CRM_STATUSES.find((s) => s.id === status);
    return found ? found.bg : "bg-stone-100 text-stone-700 border-stone-200";
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search leads by student name, phone, email, notes or institute..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-stone-400/20 focus:border-stone-400 font-medium transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Source Provider Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedProvider("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${selectedProvider === "ALL"
              ? "bg-stone-900 text-white shadow-xs"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
          >
            All Sources
          </button>
          <button
            onClick={() => setSelectedProvider("GOOGLE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${selectedProvider === "GOOGLE"
              ? "bg-red-600 text-white shadow-xs"
              : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-100"
              }`}
          >
            <SiGoogle className="w-2.5 h-2.5" /> Google Ads
          </button>
          <button
            onClick={() => setSelectedProvider("META")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${selectedProvider === "META"
              ? "bg-[#0866FF] text-white shadow-xs"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100"
              }`}
          >
            <SiMeta className="w-2.5 h-2.5" /> Meta Ads
          </button>
          <button
            onClick={() => setSelectedProvider("WEBHOOK")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${selectedProvider === "WEBHOOK"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
              }`}
          >
            <Code className="w-2.5 h-2.5" /> Webhooks
          </button>
        </div>

        {/* Institute Dropdown Selector */}
        {institutes.length > 0 && (
          <div className="w-full md:w-52">
            <select
              value={selectedInstituteId}
              onChange={(e) => setSelectedInstituteId(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-stone-400/20 cursor-pointer"
            >
              <option value="ALL">All Institutes ({institutes.length})</option>
              {institutes.map((inst: any) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Status Filter Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-bold text-stone-500 mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Status:
        </span>
        <button
          onClick={() => setSelectedStatus("ALL")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${selectedStatus === "ALL"
            ? "bg-stone-900 text-white"
            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
        >
          All ({leadsList.length})
        </button>
        {CRM_STATUSES.map((st: any) => {
          const count = leadsList.filter((l: any) => l.status === st.id).length;
          const isActive = selectedStatus === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${isActive
                ? `${st.bg} ring-2 ring-stone-900/10 shadow-xs font-extrabold`
                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
            >
              <span>{st.label}</span>
              <span className="text-[10px] px-1 py-0.1 rounded-full bg-stone-100 text-stone-600 font-mono">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Stats Counter */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-stone-500">
          Showing <span className="font-extrabold text-stone-800">{filteredLeads.length}</span>{" "}
          {filteredLeads.length === 1 ? "inbound lead" : "inbound leads"}
          {selectedInstituteId !== "ALL" && (
            <span>
              {" "}
              for{" "}
              <b className="text-stone-800">
                {institutes.find((i) => i.id === selectedInstituteId)?.name}
              </b>
            </span>
          )}
        </p>

        {(selectedInstituteId !== "ALL" ||
          selectedProvider !== "ALL" ||
          selectedStatus !== "ALL" ||
          searchQuery) && (
            <button
              onClick={() => {
                setSelectedInstituteId("ALL");
                setSelectedProvider("ALL");
                setSelectedStatus("ALL");
                setSearchQuery("");
              }}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
      </div>

      {/* Leads Table / Cards List */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800 mb-1">
            No Inbound Leads Found
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery ||
              selectedProvider !== "ALL" ||
              selectedStatus !== "ALL" ||
              selectedInstituteId !== "ALL"
              ? "Try adjusting your search query or filters to see more leads."
              : "When institutes connect their Google or Meta Ads campaigns, received leads will stream in here automatically."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Student Lead</th>
                  <th className="py-3.5 px-4">Target Institute</th>
                  <th className="py-3.5 px-4">Lead Source</th>
                  <th className="py-3.5 px-4">CRM Status</th>
                  <th className="py-3.5 px-4">Notes & Remark</th>
                  <th className="py-3.5 px-4">Received Time (IST)</th>
                  <th className="py-3.5 px-4 text-right">Quick Contact Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {filteredLeads.map((lead: any) => {
                  const formattedPhone = formatWhatsAppNumber(lead.phone);
                  const waText = encodeURIComponent(
                    `Hello ${lead.name}, thank you for your interest in ${lead.institute.name}. How can we assist you with admissions?`
                  );
                  const isEditingThisNote = editingNotesId === lead.id;

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-stone-50/80 transition group"
                    >
                      {/* Lead Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#ebdbb7]/40 text-stone-800 font-bold flex items-center justify-center text-xs shrink-0 border border-[#ebdbb7]">
                            {lead.name?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                          <div>
                            <span className="font-bold text-stone-900 block text-sm">
                              {lead.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-stone-500 text-[11px]">
                              <span className="flex items-center gap-1 font-mono font-semibold">
                                <Phone className="w-3 h-3 text-stone-400" />
                                {lead.phone}
                              </span>
                              {lead.email && (
                                <span className="flex items-center gap-1 truncate max-w-[140px]">
                                  <Mail className="w-3 h-3 text-stone-400" />
                                  {lead.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Institute */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-stone-900 block text-xs truncate max-w-[180px]">
                            {lead.institute.name}
                          </span>
                          <span className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-stone-400" />
                            {lead.institute.city?.name || "N/A"}
                            {lead.institute.subscriptionPlan && (
                              <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {lead.institute.subscriptionPlan}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Source Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getSourceBadge(lead.source)}
                        {lead.integration?.name && (
                          <span className="block text-[10px] text-stone-400 mt-1 truncate max-w-[130px]">
                            {lead.integration.name}
                          </span>
                        )}
                        {lead.sourceDetails && (
                          <button
                            onClick={() =>
                              setActivePayload({
                                leadName: lead.name,
                                source: lead.source,
                                payload: lead.sourceDetails,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 hover:text-stone-800 mt-1 cursor-pointer underline"
                          >
                            <Code className="w-2.5 h-2.5" /> Payload
                          </button>
                        )}
                      </td>

                      {/* Interactive CRM Status Selector */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={lead.status || "NEW"}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border cursor-pointer transition focus:outline-hidden focus:ring-2 focus:ring-stone-400/20 ${getStatusBadgeClass(
                            lead.status || "NEW"
                          )}`}
                        >
                          {CRM_STATUSES.map((st: any) => (
                            <option key={st.id} value={st.id}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Notes / Remark Field */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {isEditingThisNote ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              placeholder="Add admin note..."
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-stone-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveNotes(lead.id)}
                              disabled={isSavingNotes}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer disabled:opacity-50"
                              title="Save Note"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="p-1 text-stone-400 hover:bg-stone-100 rounded-md cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1 group/note">
                            <span className="text-xs text-stone-600 line-clamp-1 italic">
                              {lead.notes || lead.message || "No notes added"}
                            </span>
                            <button
                              onClick={() => {
                                setEditingNotesId(lead.id);
                                setNotesText(lead.notes || "");
                              }}
                              className="opacity-0 group-hover/note:opacity-100 p-1 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                              title="Edit Note"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-stone-500 text-xs">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          {formatIST(lead.createdAt, "dd MMM yyyy · hh:mm a")}
                        </div>
                      </td>

                      {/* Contact Actions: WhatsApp, Call, Mail & Delete */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* WhatsApp Universal Link */}
                          {lead.phone &&
                            lead.phone !== "Email-Only Lead" &&
                            lead.phone !== "Awaiting Meta Sync" && (
                              <a
                                href={`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${waText}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open WhatsApp chat with ${lead.name} (${formattedPhone})`}
                                className="w-8 h-8 rounded-xl bg-[#25D366]/15 text-[#128C7E] hover:bg-[#25D366] hover:text-white flex items-center justify-center transition active:scale-95 border border-[#25D366]/30 shadow-2xs"
                              >
                                <FaWhatsapp className="w-4 h-4" />
                              </a>
                            )}

                          {/* Phone Call Link */}
                          {lead.phone &&
                            lead.phone !== "Email-Only Lead" &&
                            lead.phone !== "Awaiting Meta Sync" && (
                              <a
                                href={`tel:${lead.phone}`}
                                title={`Call ${lead.name} (${lead.phone})`}
                                className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 hover:text-stone-950 flex items-center justify-center transition active:scale-95 border border-stone-200 shadow-2xs"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}

                          {/* Email Link */}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}?subject=Regarding your enquiry at ${encodeURIComponent(
                                lead.institute.name
                              )}&body=Dear ${encodeURIComponent(lead.name)},%0D%0A%0D%0AThank you for your enquiry.`}
                              title={`Send email to ${lead.email}`}
                              className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 hover:text-stone-950 flex items-center justify-center transition active:scale-95 border border-stone-200 shadow-2xs"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Delete Lead Button */}
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.name)}
                            title="Delete Lead"
                            className="w-8 h-8 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition active:scale-95 border border-red-200/60 shadow-2xs cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payload Modal */}
      {activePayload && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <Code className="w-4 h-4 text-stone-600" />
                  Webhook Payload Data: {activePayload.leadName}
                </h3>
                <span className="text-xs text-stone-500 font-medium">
                  Source: {activePayload.source}
                </span>
              </div>
              <button
                onClick={() => setActivePayload(null)}
                className="w-8 h-8 rounded-full bg-stone-200/80 hover:bg-stone-300 flex items-center justify-center text-stone-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-stone-900 text-stone-100">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(activePayload.payload, null, 2)}
              </pre>
            </div>

            <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                onClick={() => setActivePayload(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
