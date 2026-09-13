"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignLeadToIsm, bulkAssignLeadsToIsm } from "@/lib/instituteSalesManager/ismActions";
import { formatIST } from "@/lib/utils";
import {
  Users,
  CheckSquare,
  Square,
  CheckCircle2,
  Loader2,
  Calendar,
  Phone,
  ArrowLeft,
  UserCheck,
  Search,
} from "lucide-react";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  assignedIsmId: string | null;
}

interface IsmUser {
  id: string;
  name: string | null;
  email: string;
}

interface IsmOption {
  userId: string;
  user: IsmUser;
}

interface Props {
  instituteId: string;
  selectedIsm: IsmUser | null;
  allIsms: IsmOption[];
  initialLeads: Lead[];
}

export default function IsmAssignClient({
  instituteId,
  selectedIsm,
  allIsms,
  initialLeads,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeIsmId, setActiveIsmId] = useState(selectedIsm?.id || allIsms[0]?.userId || "");
  const [filter, setFilter] = useState<"unassigned" | "assigned_to_this" | "all">("unassigned");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeIsm = allIsms.find((a: IsmOption) => a.userId === activeIsmId)?.user || selectedIsm;

  const filteredLeads = initialLeads.filter((l: Lead) => {
    // Status filter
    if (filter === "unassigned" && l.assignedIsmId !== null) return false;
    if (filter === "assigned_to_this" && l.assignedIsmId !== activeIsmId) return false;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.email && l.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  function toggleSelectLead(id: string) {
    setSelectedLeadIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((item: string) => item !== id) : [...prev, id]
    );
  }

  function selectAllFiltered() {
    const allFilteredIds = filteredLeads.map((l: Lead) => l.id);
    const areAllSelected = allFilteredIds.every((id: string) => selectedLeadIds.includes(id));
    if (areAllSelected) {
      setSelectedLeadIds((prev: string[]) => prev.filter((id: string) => !allFilteredIds.includes(id)));
    } else {
      setSelectedLeadIds((prev: string[]) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  }

  function handleAssignSingle(leadId: string, ismId: string | null) {
    startTransition(async () => {
      const res = await assignLeadToIsm(leadId, ismId);
      if (res.success) {
        setSuccessMessage(ismId ? "Lead assigned!" : "Lead unassigned!");
        router.refresh();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    });
  }

  function handleBulkAssign() {
    if (!activeIsmId || selectedLeadIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkAssignLeadsToIsm(selectedLeadIds, activeIsmId);
      if (res.success) {
        setSuccessMessage(`Assigned ${res.count} leads to ${activeIsm?.name || "ISM"}!`);
        setSelectedLeadIds([]);
        router.refresh();
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    });
  }

  function handleBulkUnassign() {
    if (selectedLeadIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkAssignLeadsToIsm(selectedLeadIds, null);
      if (res.success) {
        setSuccessMessage(`Unassigned ${res.count} leads.`);
        setSelectedLeadIds([]);
        router.refresh();
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Select Sales Manager (Target)
            </label>
            <div className="flex items-center gap-3">
              <select
                value={activeIsmId}
                onChange={(e) => {
                  setActiveIsmId(e.target.value);
                  setSelectedLeadIds([]);
                }}
                className="bg-violet-50/70 border border-violet-200 text-violet-950 font-bold text-sm rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-violet-400 outline-none"
              >
                {allIsms.map((a: IsmOption) => (
                  <option key={a.userId} value={a.userId}>
                    {a.user.name || a.user.email}
                  </option>
                ))}
              </select>
              {activeIsm && (
                <span className="text-xs text-slate-500">
                  {initialLeads.filter((l: Lead) => l.assignedIsmId === activeIsm.id).length} currently assigned
                </span>
              )}
            </div>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedLeadIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleBulkAssign}
                  disabled={isPending || !activeIsmId}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  Assign {selectedLeadIds.length} to {activeIsm?.name?.split(" ")[0] || "ISM"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUnassign}
                  disabled={isPending}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Unassign
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl shrink-0">
            <button
              type="button"
              onClick={() => setFilter("unassigned")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === "unassigned" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Unassigned ({initialLeads.filter((l: Lead) => l.assignedIsmId === null).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("assigned_to_this")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === "assigned_to_this" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Assigned to ISM ({initialLeads.filter((l: Lead) => l.assignedIsmId === activeIsmId).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Leads ({initialLeads.length})
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMessage}
          </div>
        )}
      </div>

      {/* Leads List */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            {filteredLeads.length > 0 && filteredLeads.every((l: Lead) => selectedLeadIds.includes(l.id)) ? (
              <CheckSquare className="w-4 h-4 text-violet-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All ({filteredLeads.length})</span>
          </button>
          {selectedLeadIds.length > 0 && (
            <span className="text-xs text-violet-700 font-bold bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
              {selectedLeadIds.length} selected
            </span>
          )}
        </div>

        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-bold text-sm">No leads match this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLeads.map((lead: Lead) => {
              const isSelected = selectedLeadIds.includes(lead.id);
              const isAssignedToActive = lead.assignedIsmId === activeIsmId;
              const assignedIsmObj = allIsms.find((a: IsmOption) => a.userId === lead.assignedIsmId)?.user;

              return (
                <div
                  key={lead.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isSelected ? "bg-violet-50/40" : "hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectLead(lead.id)}
                      className="mt-0.5 text-slate-400 hover:text-violet-600"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-violet-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{lead.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.2 rounded-full font-bold">
                          {lead.status}
                        </span>
                        {assignedIsmObj ? (
                          <span className="text-[10px] bg-violet-100 text-violet-800 px-2 py-0.2 rounded-full font-bold">
                            Assigned: {assignedIsmObj.name || assignedIsmObj.email}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full font-bold">
                            Unassigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {lead.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> {formatIST(lead.createdAt, "PP")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isAssignedToActive ? (
                      <button
                        type="button"
                        onClick={() => handleAssignSingle(lead.id, null)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                      >
                        Unassign
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssignSingle(lead.id, activeIsmId)}
                        disabled={isPending || !activeIsmId}
                        className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        Assign to {activeIsm?.name?.split(" ")[0] || "ISM"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
