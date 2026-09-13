import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import AdminClaimDetailActions from "@/components/admin/AdminClaimDetailActions";
import AdminClaimWhatsAppButton from "@/components/admin/AdminClaimWhatsAppButton";
import { buildApprovalLinks } from "@/lib/institutes/claimLinks";

export default async function AdminClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const claim = await prisma.instituteClaim.findUnique({
    where: { id },
    include: {
      institute: {
        include: {
          city: true,
          managers: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          isActive: true,
        },
      },
    },
  });

  if (!claim) {
    notFound();
  }

  const { publicListingUrl, managerDashboardUrl } = buildApprovalLinks(claim as any);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 font-sans pb-12">
      {/* 🚀 Back Link */}
      <Link
        href="/af-ass-manage/claims"
        className="inline-flex items-center text-xs text-stone-500 hover:text-stone-900 transition-colors font-semibold"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to All Claims
      </Link>

      {/* 🚀 Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Institute Claim Request
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                claim.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : claim.status === "REJECTED"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {claim.status}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              ID: {claim.id}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Requested: {formatIST(claim.createdAt, "PPP 'at' p")}
            </span>
            {claim.updatedAt && (
              <span className="text-slate-400">
                Last updated: {formatIST(claim.updatedAt, "dd MMM yyyy, p")}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <AdminClaimDetailActions claim={claim as any} />
      </div>

      {/* 🚀 Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= LEFT COLUMN ================= */}
        <div className="space-y-6">
          {/* Card 1: Claimer Information */}
          <Card className="shadow-sm border-slate-200/90 rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" /> Claimer Information (From Form)
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
                  Role: {claim.role}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Full Name
                  </p>
                  <p className="font-bold text-slate-900 text-base">{claim.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Designation / Claimed Role
                  </p>
                  <p className="font-semibold text-slate-800">{claim.role}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Mobile Phone
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`tel:${claim.phone}`}
                      className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      {claim.phone}
                    </a>
                    <AdminClaimWhatsAppButton
                      phone={claim.phone}
                      managerName={claim.fullName}
                      instituteName={claim.institute?.name}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Email Address
                  </p>
                  <a
                    href={`mailto:${claim.email}`}
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1 break-all"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    {claim.email}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Registered User Account */}
          <Card className="shadow-sm border-slate-200/90 rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-purple-50/50 border-b border-purple-100/60 pb-4">
              <CardTitle className="text-sm font-extrabold text-purple-950 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600" /> Linked User Account (AcademyFind Profile)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {claim.user ? (
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-bold text-slate-900">{claim.user.name || "No name set"}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {claim.user.id}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Role: {claim.user.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                    <div>
                      <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">
                        Account Email
                      </span>
                      <span className="font-medium text-slate-800">{claim.user.email}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">
                        Account Phone
                      </span>
                      <span className="font-medium text-slate-800">
                        {claim.user.phone || "Not set on account"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">
                        Member Since
                      </span>
                      <span className="font-medium text-slate-800">
                        {formatIST(claim.user.createdAt, "dd MMM yyyy")}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">
                        Account Status
                      </span>
                      <span
                        className={`font-bold ${
                          claim.user.isActive ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {claim.user.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-500 italic flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  User account was deleted from the system.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="space-y-6">
          {/* Card 3: Institute Details */}
          <Card className="shadow-sm border-slate-200/90 rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" /> Claimed Institute Details
                </span>
                {claim.institute?.subscriptionPlan && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full border border-stone-200">
                    Plan: {claim.institute.subscriptionPlan}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {claim.institute ? (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {claim.institute.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {claim.institute.address}
                      {claim.institute.city?.name && ` (${claim.institute.city.name})`}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                    {claim.institute.phone && (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{claim.institute.phone}</span>
                      </div>
                    )}
                    {claim.institute.email && (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{claim.institute.email}</span>
                      </div>
                    )}
                    {claim.institute.website && (
                      <div className="flex items-center gap-1.5 text-blue-600 col-span-full">
                        <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <a
                          href={claim.institute.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline truncate"
                        >
                          {claim.institute.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Current Managers on Institute */}
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Existing Managers on Record
                    </span>
                    {claim.institute.managers && claim.institute.managers.length > 0 ? (
                      <div className="space-y-1.5">
                        {claim.institute.managers.map((m: any) => (
                          <div
                            key={m.userId}
                            className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60"
                          >
                            <span className="font-semibold text-slate-800">
                              {m.user?.name || "Manager"}
                            </span>
                            <span className="text-slate-500">{m.user?.email}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        No managers assigned yet (Unclaimed institute).
                      </span>
                    )}
                  </div>

                  {/* Quick Action Buttons for Institute */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                    <a
                      href={publicListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Public Profile
                    </a>

                    <Link
                      prefetch={false}
                      href={`/af-ass-manage/institutes/${claim.institute.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      Admin Institute Page
                    </Link>

                    {claim.status === "APPROVED" && (
                      <a
                        href={managerDashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                        Manager Dashboard
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-500 italic">
                  This institute has been removed from the database.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Claim Message & Dilemma */}
          <Card className="shadow-sm border-slate-200/90 rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" /> Claim Note / Proof Message
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {claim.message ? (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {claim.message.split(/(https?:\/\/[^\s]+)/g).map((part: string, i: number) =>
                    /(https?:\/\/[^\s]+)/g.test(part) ? (
                      <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {part}
                      </a>
                    ) : (
                      part
                    )
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No additional message or notes provided with this claim request.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
