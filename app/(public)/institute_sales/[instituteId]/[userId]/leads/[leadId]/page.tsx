import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import LeadDetailViewClient from "@/components/crm/LeadDetailViewClient";

export default async function IsmLeadDetailPage({
  params,
}: {
  params: Promise<{ instituteId: string; userId: string; leadId: string }>;
}) {
  const { instituteId, userId, leadId } = await params;

  const [lead, activeIsms, institute] = await Promise.all([
    prisma.instituteEnquiry.findUnique({
      where: { id: leadId },
      include: {
        assignedIsm: {
          select: { id: true, name: true, email: true, image: true },
        },
        admissionRecord: {
          include: {
            installments: {
              orderBy: { dueDate: "asc" },
            },
          },
        },
        ismActivities: {
          include: {
            ism: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    }),
    prisma.instituteSalesManagerAssignment.findMany({
      where: { instituteId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.institute.findUnique({
      where: { id: instituteId },
      select: { name: true },
    }),
  ]);

  if (!lead || lead.instituteId !== instituteId || !institute) return notFound();

  const formattedLead = {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    course: lead.course,
    batch: lead.batch,
    tags: lead.tags || [],
    status: lead.status,
    source: lead.source,
    message: lead.message,
    createdAt: lead.createdAt.toISOString(),
    assignedIsmId: lead.assignedIsmId,
    assignedIsm: lead.assignedIsm,
    nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.toISOString() : null,
    followUpNote: lead.followUpNote,
    convertedToAdmission: lead.convertedToAdmission,
    admissionRecord: lead.admissionRecord
      ? {
        ...lead.admissionRecord,
        admissionDate: lead.admissionRecord.admissionDate.toISOString(),
        installments: lead.admissionRecord.installments.map((inst: any) => ({
          ...inst,
          dueDate: inst.dueDate.toISOString(),
          paidDate: inst.paidDate ? inst.paidDate.toISOString() : null,
        })),
      }
      : null,
    ismActivities: lead.ismActivities.map((act: any) => ({
      ...act,
      createdAt: act.createdAt.toISOString(),
    })),
  };

  return (
    <LeadDetailViewClient
      lead={formattedLead}
      instituteId={instituteId}
      instituteName={institute.name}
      activeIsms={activeIsms}
      backHref={`/institute_sales/${instituteId}/${userId}/leads`}
      canEditLead={false}
    />
  );
}
