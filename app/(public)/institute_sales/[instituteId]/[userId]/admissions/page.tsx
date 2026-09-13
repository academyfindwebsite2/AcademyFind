import { prisma } from "@/lib/prisma";
import { formatIST } from "@/lib/utils";
import Link from "next/link";
import { GraduationCap, IndianRupee, ChevronRight, CheckCircle2 } from "lucide-react";

const feeStatusBadge = (s: string) => {
  switch (s) {
    case "PAID": return "bg-green-100 text-green-700 border-green-200";
    case "PARTIAL": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-red-100 text-red-700 border-red-200";
  }
};

export default async function IsmAdmissionsPage({
  params,
}: {
  params: Promise<{ instituteId: string; userId: string }>;
}) {
  const { instituteId, userId } = await params;

  const admissions = await prisma.admissionRecord.findMany({
    where: { instituteId, ismId: userId },
    include: {
      enquiry: { select: { phone: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { admissionDate: "desc" },
  });

  const totalRevenue = admissions.reduce((sum, a) => sum + a.paidAmount, 0);
  const totalOutstanding = admissions.reduce((sum, a) => sum + (a.totalFee - a.paidAmount), 0);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
          <div className="p-2 bg-green-100 text-green-700 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          Admissions & Fee Tracker
        </h1>
        <p className="text-sm text-slate-500 mt-1">Track all your converted leads and fee collection.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Admissions", value: admissions.length, color: "bg-green-50 border-green-200 text-green-800" },
          { label: "Collected", value: `₹${totalRevenue.toLocaleString("en-IN")}`, color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
          { label: "Outstanding", value: `₹${totalOutstanding.toLocaleString("en-IN")}`, color: totalOutstanding > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-slate-50 border-slate-200 text-slate-600" },
        ].map((s) => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}>
            <p className="text-xl font-black">{s.value}</p>
            <p className="text-xs font-semibold opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Admissions List */}
      {admissions.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 rounded-3xl">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 font-medium text-sm">No admissions converted yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {admissions.map((admission: any) => {
            const outstanding = admission.totalFee - admission.paidAmount;
            const paidInstallments = admission.installments.filter((i: any) => i.status === "PAID").length;
            return (
              <div key={admission.id} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-extrabold text-slate-900">{admission.studentName}</h3>
                      {admission.courseName && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                          {admission.courseName}
                        </span>
                      )}
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${feeStatusBadge(admission.feeStatus)}`}>
                        {admission.feeStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Admitted: {formatIST(admission.admissionDate, "dd MMM yyyy")} · Phone: {admission.enquiry?.phone}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-lg text-slate-900">₹{admission.paidAmount.toLocaleString("en-IN")} <span className="text-sm font-normal text-slate-400">/ ₹{admission.totalFee.toLocaleString("en-IN")}</span></p>
                    {outstanding > 0 && (
                      <p className="text-xs text-red-600 font-semibold">₹{outstanding.toLocaleString("en-IN")} outstanding</p>
                    )}
                  </div>
                </div>

                {/* Installments */}
                {admission.installments.length > 0 && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    <div className="px-5 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                      <span>Installments ({paidInstallments}/{admission.installments.length} paid)</span>
                    </div>
                    {admission.installments.map((inst: any) => (
                      <div key={inst.id} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {inst.status === "PAID"
                            ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            : <IndianRupee className="w-4 h-4 text-slate-300 shrink-0" />
                          }
                          <div>
                            <p className="font-bold text-sm text-slate-900">₹{inst.amount.toLocaleString("en-IN")}</p>
                            {inst.note && <p className="text-xs text-slate-400">{inst.note}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Due: {formatIST(inst.dueDate, "dd MMM yyyy")}</p>
                          {inst.paidDate && (
                            <p className="text-[10px] text-green-600">Paid: {formatIST(inst.paidDate, "dd MMM yyyy")}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${feeStatusBadge(inst.status === "PAID" ? "PAID" : inst.status === "OVERDUE" ? "PENDING" : "PARTIAL")}`}>
                          {inst.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
