import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, Phone, Mail, Clock, ShieldAlert, Filter } from "lucide-react";
import { LifeCoachRequestStatus } from "@/app/generated/prisma/enums";
import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import { deleteLifeCoachRequestAction } from "./actions";
import { formatIST } from "@/lib/utils";

export default async function AdminLifeCoachLeadsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams;
  const currentFilter = params.status || 'ALL';

  // Build filter condition
  const whereCondition: any = {};

  if (currentFilter !== 'ALL') {
    whereCondition.status = currentFilter as LifeCoachRequestStatus;
  }

  // Fetch requests based on filter
  const requests = await prisma.lifeCoachRequest.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });

  // Filter options array based on LifeCoachRequestStatus enum
  const filterOptions = [
    { label: "All", value: "ALL" },
    { label: "Pending", value: "PENDING" },
    { label: "Contacted", value: "CONTACTED" },
    { label: "Messaged", value: "MESSAGED" },
    { label: "Called", value: "CALLED" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "Junk", value: "JUNK" },
    { label: "DNP", value: "DNP" },
  ];

  return (
    <div className="p-8 w-full space-y-8 font-sans animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Life Coach Requests</h1>
            <p className="text-sm text-slate-500">Manage and follow up with students who need mentorship. (Showing: {currentFilter})</p>
          </div>
        </div>
        <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-xl font-bold text-sm shrink-0">
          Total Requests: {requests.length}
        </div>
      </div>

      {/* 🚀 Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <div className="text-sm font-bold text-slate-400 flex items-center gap-1.5 mr-2">
          <Filter className="w-4 h-4" /> Filter:
        </div>
        {filterOptions.map((opt: any) => (
          <Link
            key={opt.value}
            prefetch={false}
            href={`/af-ass-manage/life-coach?status=${opt.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${currentFilter === opt.value
              ? "bg-stone-900 text-white shadow-md shadow-stone-900/20 scale-105"
              : "bg-white border border-stone-100 text-slate-500 hover:bg-stone-50 hover:text-stone-700 hover:border-stone-200"
              }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-stone-100/60 rounded-[2rem] shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-100/50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4">Student Name</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Message / Query</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100/50">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">No counseling requests found for "{currentFilter}".</td>
                </tr>
              ) : (
                requests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{req.fullName}</td>
                    <td className="p-4 text-sm text-slate-600 space-y-1">
                      <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {req.phone}</div>
                      {req.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> {req.email}</div>}
                    </td>
                    <td className="p-4 max-w-[280px]">
                      {req.message ? (
                        <p className="text-xs text-slate-700 font-medium line-clamp-2" title={req.message}>
                          {req.message}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No message provided</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatIST(req.createdAt, "dd MMM yyyy")}
                        </div>
                        <span className="text-xs text-slate-400 mt-1 pl-5">{formatIST(req.createdAt, "hh:mm a")}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${req.status === "PENDING" ? "bg-stone-50 text-stone-700 border-stone-200" :
                        req.status === "CONTACTED" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          req.status === "MESSAGED" ? "bg-teal-50 text-teal-700 border-teal-200" :
                            req.status === "CALLED" ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                              req.status === "RESOLVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                req.status === "JUNK" ? "bg-red-50 text-red-700 border-red-200" :
                                  "bg-slate-100 text-slate-700 border-slate-300"
                        }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link prefetch={false} href={`/af-ass-manage/life-coach/${req.id}`}>
                          <button className="inline-flex items-center justify-center p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-purple-100 hover:text-purple-700 transition-colors cursor-pointer">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <AdminDeleteButton id={req.id} onDelete={deleteLifeCoachRequestAction} title="Delete Request?" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}