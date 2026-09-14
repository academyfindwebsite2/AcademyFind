"use client";

import {
  X,
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GraduationCap,
  IndianRupee,
  Layers,
  Globe,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  instituteName: string;
  stats?: {
    totalLeads: number;
    newCount: number;
    contactedCount: number;
    convertedCount: number;
    dueTodayCount: number;
    overdueCount: number;
    sourceCounts: { source: string; count: number }[];
    courseCounts: { course: string; count: number }[];
    ismConversions: { name: string; count: number; feeCollected: number }[];
    feeSummary: {
      totalRevenue: number;
      totalPaid: number;
      outstanding: number;
    };
  } | null;
}

export default function CrmReportsModal({
  isOpen,
  onClose,
  instituteName,
  stats,
}: Props) {
  if (!isOpen) return null;

  const sourceCounts = stats?.sourceCounts || [];
  const ismConversions = stats?.ismConversions || [];
  const feeSummary = stats?.feeSummary || { totalRevenue: 0, totalPaid: 0, outstanding: 0 };
  const totalLeads = stats?.totalLeads || 0;
  const newCount = stats?.newCount || 0;
  const contactedCount = stats?.contactedCount || 0;
  const convertedCount = stats?.convertedCount || 0;
  const dueTodayCount = stats?.dueTodayCount || 0;
  const overdueCount = stats?.overdueCount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-stone-900 text-white rounded-2xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-lg">
                Coaching CRM Pipeline Reports
              </h3>
              <p className="text-xs text-stone-500">
                Key admission conversions, sales team performance, and fee summaries for{" "}
                <strong>{instituteName}</strong>
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Funnel Overview */}
          <div>
            <h4 className="font-bold text-stone-700 uppercase tracking-wider text-xs mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-violet-600" /> Conversion Funnel
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-2xl">
                <span className="text-stone-500 font-bold text-[10px] uppercase block">Total Leads</span>
                <span className="text-2xl font-black text-stone-900 mt-1 block">{totalLeads}</span>
                <span className="text-[10px] text-stone-400">All captured</span>
              </div>
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl">
                <span className="text-amber-700 font-bold text-[10px] uppercase block">New & Uncontacted</span>
                <span className="text-2xl font-black text-amber-900 mt-1 block">{newCount}</span>
                <span className="text-[10px] text-amber-600">Awaiting contact</span>
              </div>
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl">
                <span className="text-blue-700 font-bold text-[10px] uppercase block">Contacted</span>
                <span className="text-2xl font-black text-blue-900 mt-1 block">{contactedCount}</span>
                <span className="text-[10px] text-blue-600">Called / Messaged</span>
              </div>
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="text-emerald-700 font-bold text-[10px] uppercase block">Converted Admissions</span>
                <span className="text-2xl font-black text-emerald-900 mt-1 block">{convertedCount}</span>
                <span className="text-[10px] text-emerald-600">
                  {totalLeads > 0
                    ? `${Math.round((convertedCount / totalLeads) * 100)}% conversion`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>

          {/* Follow-up Health & Fee Collection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Follow-up Health */}
            <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-3">
              <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" /> Follow-up Health
              </h5>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-white border border-stone-200 rounded-xl">
                  <span className="text-stone-500 block text-[10px]">Due Today</span>
                  <span className="text-lg font-black text-amber-700 block mt-0.5">
                    {dueTodayCount}
                  </span>
                </div>
                <div className="p-3 bg-white border border-stone-200 rounded-xl">
                  <span className="text-stone-500 block text-[10px] flex items-center gap-1">
                    Overdue {overdueCount > 0 && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                  </span>
                  <span className={`text-lg font-black block mt-0.5 ${overdueCount > 0 ? "text-rose-600" : "text-stone-700"}`}>
                    {overdueCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Fee Collection Summary */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
              <h5 className="font-bold text-emerald-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-600" /> Fee Collection Summary
              </h5>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-white border border-emerald-100 rounded-xl">
                  <span className="text-stone-400 block text-[9px]">Total Enrolled</span>
                  <span className="text-xs font-bold text-stone-900 block mt-0.5 truncate">
                    ₹{feeSummary.totalRevenue.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-emerald-100 rounded-xl">
                  <span className="text-emerald-600 block text-[9px]">Paid</span>
                  <span className="text-xs font-bold text-emerald-800 block mt-0.5 truncate">
                    ₹{feeSummary.totalPaid.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-emerald-100 rounded-xl">
                  <span className="text-rose-500 block text-[9px]">Outstanding</span>
                  <span className="text-xs font-bold text-rose-700 block mt-0.5 truncate">
                    ₹{feeSummary.outstanding.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Leads by Source & Leads by Course */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Leads by Source */}
            <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-2.5">
              <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-500" /> Leads by Source
              </h5>
              {sourceCounts.length === 0 ? (
                <p className="text-stone-400 italic">No source data yet</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {sourceCounts.map((s: any) => (
                    <div key={s.source} className="flex items-center justify-between p-2 bg-white rounded-xl border border-stone-100 text-xs">
                      <span className="font-medium text-stone-700">{s.source}</span>
                      <span className="font-bold text-stone-900 px-2 py-0.5 bg-stone-100 rounded-md">
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversions by Sales Manager */}
            <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-2.5">
              <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-violet-600" /> Conversions by Sales Team
              </h5>
              {ismConversions.length === 0 ? (
                <p className="text-stone-400 italic">No conversions recorded yet</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {ismConversions.map((ism: any) => (
                    <div key={ism.name} className="flex items-center justify-between p-2 bg-white rounded-xl border border-stone-100 text-xs">
                      <span className="font-medium text-stone-700 truncate">{ism.name}</span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-700 mr-2">
                          {ism.count} converted
                        </span>
                        <span className="text-[10px] text-stone-400">
                          (₹{ism.feeCollected.toLocaleString("en-IN")})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
