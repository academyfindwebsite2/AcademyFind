import { prisma } from "@/lib/prisma";
import { formatIST } from "@/lib/utils";
import Link from "next/link";
import { Users, Phone, Eye, Filter, Calendar, CalendarClock, GraduationCap } from "lucide-react";

const STATUS_OPTIONS = ["ALL", "NEW", "PENDING", "MESSAGED", "CALLED", "FOLLOW_UP", "APPROVED", "JUNK"];

const statusColor = (s: string) => {
  switch (s) {
    case "NEW": case "PENDING": return "bg-amber-100 text-amber-800 border-amber-200";
    case "CALLED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "MESSAGED": return "bg-purple-100 text-purple-700 border-purple-200";
    case "FOLLOW_UP": return "bg-orange-100 text-orange-700 border-orange-200";
    case "APPROVED": return "bg-green-100 text-green-700 border-green-200";
    case "JUNK": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export default async function IsmLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ instituteId: string; userId: string }>;
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const { instituteId, userId } = await params;
  const sp = await searchParams;
  const currentStatus = sp.status || "ALL";
  const search = sp.search || "";

  const where: any = { instituteId, assignedIsmId: userId };
  if (currentStatus !== "ALL") where.status = currentStatus;
  if (search.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { phone: { contains: search.trim() } },
    ];
  }

  const leads = await prisma.instituteEnquiry.findMany({
    where,
    orderBy: [{ nextFollowUp: "asc" }, { updatedAt: "desc" }],
  });

  const counts = await Promise.all(
    STATUS_OPTIONS.map((s: string) =>
      prisma.instituteEnquiry.count({
        where: s === "ALL" ? { instituteId, assignedIsmId: userId } : { instituteId, assignedIsmId: userId, status: s },
      })
    )
  );
  const statusCounts = Object.fromEntries(STATUS_OPTIONS.map((s: string, i: number) => [s, counts[i]]));
  type IsmLeadItem = (typeof leads)[number];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-violet-100 text-violet-700 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            My Leads
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            All leads assigned to you for this institute. Contact, update status, and schedule follow-ups.
          </p>
        </div>
        <div className="bg-violet-50 text-violet-800 border border-violet-100 px-4 py-2 rounded-2xl font-bold text-sm shrink-0">
          {statusCounts["ALL"]} Total Leads
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name or phone..."
          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
        />
        {currentStatus !== "ALL" && <input type="hidden" name="status" value={currentStatus} />}
        <button type="submit" className="px-4 py-2 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition">
          Search
        </button>
      </form>

      {/* Status Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </div>
        {STATUS_OPTIONS.map((s: string) => (
          <Link
            key={s}
            prefetch={false}
            href={`/institute_sales/${instituteId}/${userId}/leads?status=${s}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              currentStatus === s
                ? "bg-violet-700 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.replace("_", " ")}
            <span className={`text-[10px] px-1.5 rounded-full font-extrabold ${currentStatus === s ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
              {statusCounts[s]}
            </span>
          </Link>
        ))}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-xs font-bold">
              <tr>
                <th className="p-4 text-left">Date</th>
                <th className="p-4 text-left">Student</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Follow-up</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>No leads found.</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead: IsmLeadItem) => (
                  <tr key={lead.id} className="hover:bg-slate-50/60 transition group">
                    <td className="p-4 whitespace-nowrap text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatIST(lead.createdAt, "dd MMM yyyy")}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{lead.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </p>
                      {lead.convertedToAdmission && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <GraduationCap className="w-3 h-3" /> Admitted
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${statusColor(lead.status)}`}>
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4">
                      {lead.nextFollowUp ? (
                        <div className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
                          <CalendarClock className="w-3.5 h-3.5" />
                          {formatIST(lead.nextFollowUp, "dd MMM · hh:mm a")}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/institute_sales/${instituteId}/${userId}/leads/${lead.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View & Update
                      </Link>
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
