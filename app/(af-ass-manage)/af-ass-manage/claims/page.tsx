import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import { Building2, User, Phone, Mail, FileText, Filter } from "lucide-react";
import { deleteClaimAction } from "./actions";
import AdminClaimWhatsAppButton from "@/components/admin/AdminClaimWhatsAppButton";
import AdminClaimRowActions from "@/components/admin/AdminClaimRowActions";

export default async function AdminClaimPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams;
  const currentFilter = params.status || 'PENDING'; // Default PENDING par rakha hai

  // Build filter condition
  const whereCondition: any = {};
  if (currentFilter !== 'ALL') {
    whereCondition.status = currentFilter;
  }

  // Fetch claims directly with relations and filters
  const claims = await prisma.instituteClaim.findMany({
    where: whereCondition,
    include: {
      institute: {
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: { select: { name: true } }
        }
      },
      user: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const filterOptions = [
    { label: "All", value: "ALL" },
    { label: "Pending", value: "PENDING" },
    { label: "Approved", value: "APPROVED" },
    { label: "Rejected", value: "REJECTED" },
  ];

  return (
    <div className="w-full space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Institute Claims</h1>
            <p className="text-sm text-slate-500">Manage ownership requests for listed institutes. (Showing: {currentFilter})</p>
          </div>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-xl font-bold text-sm shrink-0">
          Total Claims: {claims.length}
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
            href={`/af-ass-manage/claims?status=${opt.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${currentFilter === opt.value
              ? "bg-slate-800 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4">Date</th>
                <th className="p-4">Institute Details</th>
                <th className="p-4">Claimer Info</th>
                <th className="p-4 w-64">Message</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-medium bg-slate-50/50">
                    No claim requests found for "{currentFilter}".
                  </td>
                </tr>
              ) : (
                claims.map((claim: any) => (
                  <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">

                    {/* Date */}
                    <td className="p-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {formatIST(claim.createdAt, "dd MMM yyyy")} <br />
                      <span className="text-xs text-slate-400">{formatIST(claim.createdAt, "hh:mm a")}</span>
                    </td>

                    {/* Institute Details */}
                    <td className="p-4">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {claim.institute ? (
                          <Link prefetch={false} href={`/af-ass-manage/institutes/${claim.instituteId}`} className="hover:text-blue-600 transition">
                            {claim.institute.name}
                          </Link>
                        ) : (
                          <span className="text-red-500 italic">Institute Deleted</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {claim.institute?.address}
                      </div>
                    </td>

                    {/* Claimer Details */}
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <Link prefetch={false} href={`/af-ass-manage/claims/${claim.id}`} className="hover:text-blue-600 transition underline-offset-2 hover:underline">
                          {claim.fullName}
                        </Link>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" /> {claim.email}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" /> {claim.phone}
                          </span>
                          <AdminClaimWhatsAppButton
                            phone={claim.phone}
                            managerName={claim.fullName}
                            instituteName={claim.institute?.name}
                          />
                        </div>
                      </div>
                      <span className="inline-block mt-2 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-indigo-100">
                        Role: {claim.role}
                      </span>
                    </td>

                    {/* Message */}
                    <td className="p-4">
                      <Link prefetch={false} href={`/af-ass-manage/claims/${claim.id}`} className="block group">
                        <div className="text-xs text-slate-600 bg-slate-50 group-hover:bg-slate-100 group-hover:border-slate-300 p-2.5 rounded-xl border border-slate-100 transition italic line-clamp-3">
                          {claim.message || "No specific message provided."}
                        </div>
                      </Link>
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${claim.status === "PENDING" ? "bg-stone-50 text-stone-700 border-stone-200" :
                        claim.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }`}>
                        {claim.status}
                      </span>
                    </td>

                    {/* Actions Buttons */}
                    <td className="p-4 text-right">
                      <AdminClaimRowActions
                        claim={claim}
                        onDeleteClaim={deleteClaimAction}
                      />
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