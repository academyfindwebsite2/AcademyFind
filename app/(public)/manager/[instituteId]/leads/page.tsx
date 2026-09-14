import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, PlanType } from "@/lib/plan_limits";
import Link from "next/link";
import { Lock } from "lucide-react";
import LeadInboxTableClient, {
  type UnifiedLeadItem,
} from "@/components/crm/LeadInboxTableClient";

export default async function EnquiriesPage({
  params,
}: {
  params: Promise<{ instituteId: string }>;
}) {
  const { instituteId } = await params;

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
    },
  });

  if (!institute) {
    return <div className="p-8 text-center text-stone-500">Institute not found</div>;
  }

  const limits = PLAN_LIMITS[institute.subscriptionPlan as PlanType];
  if (!limits.hasLeads) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-stone-50/50 rounded-3xl border border-dashed border-stone-200">
        <div className="w-16 h-16 bg-[#ebdbb7]/30 text-stone-800 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">Student Leads Locked</h2>
        <p className="text-stone-500 max-w-md mb-6">
          Unlock direct student enquiries and lead generation from AcademyFind, Meta Ads, and Google Ads. Upgrade to the <b>Premium Plan</b> or <b>Ultra Plan</b>.
        </p>
        <Link
          href={`/manager/${instituteId}/subscription`}
          className="bg-stone-800 hover:bg-stone-900 text-white px-6 py-2.5 rounded-xl font-medium transition"
        >
          View Upgrade Plans
        </Link>
      </div>
    );
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Fetch enquiries, inbound leads, active ISMs, and admissions
  const [directEnquiries, inboundLeads, activeIsms, admissions] = await Promise.all([
    prisma.instituteEnquiry.findMany({
      where: { instituteId },
      include: {
        assignedIsm: { select: { id: true, name: true, email: true, image: true } },
        admissionRecord: {
          select: { id: true, courseName: true, totalFee: true, paidAmount: true, feeStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inboundLead.findMany({
      where: { instituteId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.instituteSalesManagerAssignment.findMany({
      where: { instituteId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.admissionRecord.findMany({
      where: { instituteId },
      select: {
        id: true,
        ismId: true,
        totalFee: true,
        paidAmount: true,
        ism: { select: { name: true, email: true } },
      },
    }),
  ]);

  // Format and unify all leads
  const combinedLeads: UnifiedLeadItem[] = [
    ...directEnquiries.map((e: any) => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      email: e.email,
      course: e.course || null,
      batch: e.batch || null,
      tags: e.tags || [],
      status: e.status,
      source: e.source || "ACADEMYFIND",
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      assignedIsmId: e.assignedIsmId,
      assignedIsm: e.assignedIsm,
      nextFollowUp: e.nextFollowUp ? e.nextFollowUp.toISOString() : null,
      followUpNote: e.followUpNote,
      convertedToAdmission: e.convertedToAdmission,
      parentId: e.parentId,
    })),
    ...inboundLeads.map((l: any) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      course: null,
      batch: null,
      tags: [],
      status: l.status,
      source: l.source,
      message: l.message,
      createdAt: l.createdAt.toISOString(),
      assignedIsmId: null,
      assignedIsm: null,
      nextFollowUp: null,
      followUpNote: l.notes,
      convertedToAdmission: false,
      parentId: null,
    })),
  ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Compute CRM pipeline reports metrics
  const sourceCountMap: Record<string, number> = {};
  const courseCountMap: Record<string, number> = {};

  let newCount = 0;
  let contactedCount = 0;
  let convertedCount = 0;
  let dueTodayCount = 0;
  let overdueCount = 0;

  combinedLeads.forEach((l: any) => {
    // Source
    sourceCountMap[l.source] = (sourceCountMap[l.source] || 0) + 1;

    // Course
    if (l.course) {
      courseCountMap[l.course] = (courseCountMap[l.course] || 0) + 1;
    }

    // Funnel counts
    if (l.status === "NEW") newCount++;
    if (["MESSAGED", "CALLED", "DNP", "CONTACT_LATER", "FOLLOW_UP"].includes(l.status)) {
      contactedCount++;
    }
    if (l.convertedToAdmission || l.status === "CONVERTED" || l.status === "APPROVED") {
      convertedCount++;
    }

    // Follow-ups
    if (l.nextFollowUp) {
      const fDate = new Date(l.nextFollowUp);
      if (fDate >= startOfToday && fDate <= endOfToday) {
        dueTodayCount++;
      } else if (fDate < now && !l.convertedToAdmission) {
        overdueCount++;
      }
    }
  });

  // ISM conversions breakdown
  const ismConversionMap: Record<string, { name: string; count: number; feeCollected: number }> = {};
  admissions.forEach((adm: any) => {
    const ismKey = adm.ismId;
    const ismName = adm.ism?.name || adm.ism?.email || "Sales Manager";
    if (!ismConversionMap[ismKey]) {
      ismConversionMap[ismKey] = { name: ismName, count: 0, feeCollected: 0 };
    }
    ismConversionMap[ismKey].count += 1;
    ismConversionMap[ismKey].feeCollected += adm.paidAmount;
  });

  const totalRevenue = admissions.reduce((sum: number, a: any) => sum + a.totalFee, 0);
  const totalPaid = admissions.reduce((sum: number, a: any) => sum + a.paidAmount, 0);
  const outstanding = Math.max(0, totalRevenue - totalPaid);

  const reportsStats = {
    totalLeads: combinedLeads.length,
    newCount,
    contactedCount,
    convertedCount,
    dueTodayCount,
    overdueCount,
    sourceCounts: Object.entries(sourceCountMap).map(([source, count]: any) => ({ source, count })),
    courseCounts: Object.entries(courseCountMap).map(([course, count]: any) => ({ course, count })),
    ismConversions: Object.values(ismConversionMap),
    feeSummary: {
      totalRevenue,
      totalPaid,
      outstanding,
    },
  };

  return (
    <LeadInboxTableClient
      instituteId={instituteId}
      instituteName={institute.name}
      initialLeads={combinedLeads}
      activeIsms={activeIsms}
      reportsStats={reportsStats}
    />
  );
}