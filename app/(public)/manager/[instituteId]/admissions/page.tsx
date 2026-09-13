import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import {
  GraduationCap,
  TrendingUp,
  DollarSign,
  UserCheck,
  Calendar,
  Phone,
  ArrowRight,
  Clock,
  CheckCircle2,
  Users,
} from "lucide-react";

export default async function ManagerAdmissionsPage({
  params,
}: {
  params: Promise<{ instituteId: string }>;
}) {
  const { instituteId } = await params;

  const [institute, admissions] = await Promise.all([
    prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, name: true },
    }),
    prisma.admissionRecord.findMany({
      where: { instituteId },
      include: {
        ism: { select: { id: true, name: true, email: true, image: true } },
        enquiry: { select: { id: true, name: true, phone: true, email: true } },
        installments: { orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!institute) return notFound();

  type AdmissionItem = (typeof admissions)[number];
  type InstallmentItem = AdmissionItem["installments"][number];

  // Financial aggregates
  const totalAdmissions = admissions.length;
  const totalRevenue = admissions.reduce((acc: number, a: AdmissionItem) => acc + (a.totalFee || 0), 0);
  const totalPaid = admissions.reduce((acc: number, a: AdmissionItem) => acc + (a.paidAmount || 0), 0);
  const pendingBalance = Math.max(0, totalRevenue - totalPaid);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            Admissions Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track all admissions converted by your Sales Team for <strong>{institute.name}</strong>.
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-2xl font-bold text-sm shrink-0">
          {totalAdmissions} Total Admissions
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Admissions</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalAdmissions}</p>
          <p className="text-xs text-slate-400 mt-1">Total students enrolled</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Booked Fee</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">₹{totalRevenue.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-400 mt-1">Course value booked</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fee Collected</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-green-700">₹{totalPaid.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-400 mt-1">
            {totalRevenue > 0 ? `${Math.round((totalPaid / totalRevenue) * 100)}% collected` : "0% collected"}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Balance</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-700">₹{pendingBalance.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-400 mt-1">To be collected</p>
        </div>
      </div>

      {/* Admissions List */}
      {admissions.length === 0 ? (
        <div className="p-16 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No admissions converted yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When your Institute Sales Managers convert student enquiries into course admissions, they will appear here with full fee details.
          </p>
          <Link
            href={`/manager/${instituteId}/leads`}
            className="inline-block mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            View Student Leads
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Student Admission Records ({admissions.length})
          </h2>

          <div className="grid gap-4">
            {admissions.map((adm: AdmissionItem) => {
              const feePct = adm.totalFee > 0 ? Math.min(100, Math.round((adm.paidAmount / adm.totalFee) * 100)) : 0;
              const pending = Math.max(0, adm.totalFee - adm.paidAmount);

              return (
                <div
                  key={adm.id}
                  className="bg-white border border-slate-200 hover:border-emerald-200 rounded-3xl p-6 shadow-xs transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-extrabold text-base text-slate-900">{adm.studentName}</h3>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          {adm.courseName || "General Course"}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            adm.feeStatus === "PAID"
                              ? "bg-green-100 text-green-800"
                              : adm.paidAmount > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {adm.feeStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                        {adm.enquiry.phone && (
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {adm.enquiry.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Admitted on {formatIST(adm.createdAt, "PP")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                          Converted by ISM
                        </span>
                        <span className="text-xs font-bold text-violet-700 flex items-center gap-1 justify-end">
                          <UserCheck className="w-3.5 h-3.5" />
                          {adm.ism.name || adm.ism.email}
                        </span>
                      </div>

                      <Link
                        href={`/manager/${instituteId}/leads/${adm.enquiryId}`}
                        className="ml-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        Details <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Financial bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Paid: <strong>₹{adm.paidAmount.toLocaleString("en-IN")}</strong> / ₹{adm.totalFee.toLocaleString("en-IN")}
                      </span>
                      <span className="text-slate-500">
                        Balance Due: <strong className="text-amber-700">₹{pending.toLocaleString("en-IN")}</strong> ({feePct}% paid)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${feePct}%` }}
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Installments overview */}
                  {adm.installments.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Installments ({adm.installments.length}):
                      </span>
                      {adm.installments.map((inst: InstallmentItem, idx: number) => (
                        <span
                          key={inst.id}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium ${
                            inst.status === "PAID"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          #{idx + 1}: ₹{inst.amount.toLocaleString("en-IN")} ({inst.status})
                        </span>
                      ))}
                    </div>
                  )}

                  {adm.admissionNote && (
                    <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <strong>Note:</strong> {adm.admissionNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
