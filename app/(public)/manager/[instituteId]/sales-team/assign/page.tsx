import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, UserCheck } from "lucide-react";
import IsmAssignClient from "./IsmAssignClient";

export default async function AssignLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ instituteId: string }>;
  searchParams: Promise<{ ism?: string }>;
}) {
  const { instituteId } = await params;
  const { ism: ismId } = await searchParams;

  const [institute, allIsms, leads] = await Promise.all([
    prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, name: true },
    }),
    prisma.instituteSalesManagerAssignment.findMany({
      where: { instituteId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.instituteEnquiry.findMany({
      where: { instituteId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        message: true,
        createdAt: true,
        assignedIsmId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!institute) return notFound();

  const selectedIsm = ismId
    ? allIsms.find((a) => a.userId === ismId)?.user || null
    : allIsms[0]?.user || null;

  const formattedLeads = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <Link
          href={`/manager/${instituteId}/sales-team`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-3 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sales Team
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <UserCheck className="w-6 h-6" />
              </div>
              Assign Leads to ISM
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select enquiries from <strong>{institute.name}</strong> to distribute to your Sales Managers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-3.5 py-1.5 rounded-2xl font-bold text-xs">
              {leads.filter((l) => !l.assignedIsmId).length} Unassigned Leads
            </span>
          </div>
        </div>
      </div>

      {allIsms.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 rounded-3xl bg-white">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-700">No active Sales Managers found.</p>
          <p className="text-xs text-slate-400 mt-1">
            Please invite and activate an ISM in the Sales Team page first.
          </p>
          <Link
            href={`/manager/${instituteId}/sales-team`}
            className="inline-block mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Go to Sales Team
          </Link>
        </div>
      ) : (
        <IsmAssignClient
          instituteId={instituteId}
          selectedIsm={selectedIsm}
          allIsms={allIsms as any}
          initialLeads={formattedLeads}
        />
      )}
    </div>
  );
}
