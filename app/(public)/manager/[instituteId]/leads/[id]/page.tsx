import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import LeadDetailViewClient from "@/components/crm/LeadDetailViewClient";

export default async function LeadDetailedPage({
  params,
}: {
  params: Promise<{ id: string; instituteId: string }>;
}) {
  const { id, instituteId } = await params;

  const [enquiry, activeIsms, institute] = await Promise.all([
    prisma.instituteEnquiry.findUnique({
      where: { id },
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

  if (!institute) return notFound();

  let formattedLead: any = null;

  if (enquiry) {
    formattedLead = {
      id: enquiry.id,
      name: enquiry.name,
      phone: enquiry.phone,
      email: enquiry.email,
      course: enquiry.course,
      batch: enquiry.batch,
      tags: enquiry.tags || [],
      status: enquiry.status,
      source: enquiry.source,
      message: enquiry.message,
      createdAt: enquiry.createdAt.toISOString(),
      assignedIsmId: enquiry.assignedIsmId,
      assignedIsm: enquiry.assignedIsm,
      nextFollowUp: enquiry.nextFollowUp ? enquiry.nextFollowUp.toISOString() : null,
      followUpNote: enquiry.followUpNote,
      convertedToAdmission: enquiry.convertedToAdmission,
      admissionRecord: enquiry.admissionRecord
        ? {
          ...enquiry.admissionRecord,
          admissionDate: enquiry.admissionRecord.admissionDate.toISOString(),
          installments: enquiry.admissionRecord.installments.map((inst: any) => ({
            ...inst,
            dueDate: inst.dueDate.toISOString(),
            paidDate: inst.paidDate ? inst.paidDate.toISOString() : null,
          })),
        }
        : null,
      ismActivities: enquiry.ismActivities.map((act: any) => ({
        ...act,
        createdAt: act.createdAt.toISOString(),
      })),
    };
  } else {
    // Check inbound lead
    const inbound = await prisma.inboundLead.findUnique({
      where: { id },
    });
    if (!inbound) return notFound();

    formattedLead = {
      id: inbound.id,
      name: inbound.name,
      phone: inbound.phone,
      email: inbound.email,
      course: null,
      batch: null,
      tags: [],
      status: inbound.status,
      source: inbound.source,
      message: inbound.message,
      createdAt: inbound.createdAt.toISOString(),
      assignedIsmId: null,
      assignedIsm: null,
      nextFollowUp: null,
      followUpNote: inbound.notes,
      convertedToAdmission: false,
      admissionRecord: null,
      ismActivities: [],
    };
  }

  return (
    <LeadDetailViewClient
      lead={formattedLead}
      instituteId={instituteId}
      instituteName={institute.name}
      activeIsms={activeIsms}
      backHref={`/manager/${instituteId}/leads`}
      canEditLead={true}
    />
  );
}