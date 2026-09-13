"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser } from "@/lib/notifications/notify";

import type { NotificationType } from "@/app/generated/prisma/client";

async function verifyIsmAccess(enquiryId: string) {
  const session = await getSession();
  if (!session?.user) return { error: "Unauthorized.", session: null, enquiry: null };

  const enquiry = await prisma.instituteEnquiry.findUnique({
    where: { id: enquiryId },
    include: { institute: { select: { id: true, name: true } } },
  });
  if (!enquiry) return { error: "Lead not found.", session: null, enquiry: null };

  const isAdmin = session.user.role === "ADMIN";
  const isAssignedIsm = enquiry.assignedIsmId === session.user.id;
  const isInstituteManager = !!(await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId: enquiry.instituteId } },
  }));

  if (!isAdmin && !isAssignedIsm && !isInstituteManager) {
    return { error: "You are not authorized to update this lead.", session: null, enquiry: null };
  }

  return { error: null, session, enquiry };
}

function revalidateIsmPaths(enquiry: { instituteId: string; id: string }, ismId: string | null) {
  revalidatePath(`/manager/${enquiry.instituteId}/leads`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads/${enquiry.id}`);
  if (ismId) {
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${ismId}/leads`);
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${ismId}/leads/${enquiry.id}`);
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${ismId}`);
  }
}

async function notifyInstituteManagers(
  instituteId: string,
  title: string,
  body: string,
  enquiryId?: string,
  excludeUserId?: string
) {
  try {
    const managers = await prisma.instituteManager.findMany({
      where: { instituteId },
      select: { userId: true },
    });

    const targetUserIds = new Set<string>();
    for (const m of managers) targetUserIds.add(m.userId);

    if (excludeUserId) {
      targetUserIds.delete(excludeUserId);
    }

    for (const targetId of targetUserIds) {
      await notifyUser(
        targetId,
        "SYSTEM" as NotificationType,
        title,
        body,
        enquiryId,
      );
    }
  } catch (err) {
    console.error("Failed to notify institute managers:", err);
  }
}

// ─── 1. Update lead status ────────────────────────────────────────────────────
export async function updateIsmLeadStatus(enquiryId: string, status: string) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  const oldStatus = enquiry.status;

  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: { status, lastUpdatedByRole: session.user.role, lastUpdatedByName: session.user.name || "ISM" },
  });

  // Log activity
  if (enquiry.assignedIsmId) {
    await prisma.ismLeadActivity.create({
      data: {
        enquiryId,
        ismId: enquiry.assignedIsmId,
        type: "STATUS_CHANGED",
        content: `Status changed from ${oldStatus} to ${status}`,
        meta: { oldStatus, newStatus: status },
      },
    });
  }

  // 🔔 Notify Institute Managers
  const ismName = session.user.name || "Sales Manager";
  await notifyInstituteManagers(
    enquiry.instituteId,
    `📌 Lead Status Updated (${status})`,
    `${ismName} updated status of lead "${enquiry.name}" from ${oldStatus} to ${status}.`,
    enquiryId,
    session.user.id
  );

  revalidateIsmPaths(enquiry, enquiry.assignedIsmId);
  return { success: true };
}

// ─── 2. Schedule follow-up ────────────────────────────────────────────────────
export async function scheduleIsmFollowUp(enquiryId: string, nextFollowUp: string, followUpNote?: string) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: {
      nextFollowUp: new Date(nextFollowUp),
      followUpNote: followUpNote || null,
      status: "FOLLOW_UP",
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "ISM",
    },
  });

  if (enquiry.assignedIsmId) {
    await prisma.ismLeadActivity.create({
      data: {
        enquiryId,
        ismId: enquiry.assignedIsmId,
        type: "FOLLOWUP_SET",
        content: `Follow-up scheduled for ${new Date(nextFollowUp).toLocaleDateString("en-IN")}${followUpNote ? `: ${followUpNote}` : ""}`,
      },
    });
  }

  // 🔔 Notify Institute Managers
  const ismName = session.user.name || "Sales Manager";
  const dateFormatted = new Date(nextFollowUp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  await notifyInstituteManagers(
    enquiry.instituteId,
    `📅 Follow-up Scheduled`,
    `${ismName} scheduled a follow-up for lead "${enquiry.name}" on ${dateFormatted}${followUpNote ? `. Note: "${followUpNote}"` : ""}.`,
    enquiryId,
    session.user.id
  );

  revalidateIsmPaths(enquiry, enquiry.assignedIsmId);
  return { success: true };
}

// ─── 3. Add a note ────────────────────────────────────────────────────────────
export async function addIsmNote(enquiryId: string, note: string) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  const trimmed = note.trim();
  if (!trimmed) return { success: false, error: "Note cannot be empty." };

  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: {
      ismNote: trimmed,
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "ISM",
    },
  });

  const actorId = enquiry.assignedIsmId || session.user.id;
  await prisma.ismLeadActivity.create({
    data: {
      enquiryId,
      ismId: actorId,
      type: "NOTE",
      content: trimmed,
    },
  });

  // 🔔 Notify Institute Managers
  const ismName = session.user.name || "Sales Manager";
  await notifyInstituteManagers(
    enquiry.instituteId,
    `📝 New Lead Note Added`,
    `${ismName} added a note on lead "${enquiry.name}": "${trimmed}"`,
    enquiryId,
    session.user.id
  );

  revalidateIsmPaths(enquiry, enquiry.assignedIsmId);
  return { success: true };
}

// ─── 4. Log a call ────────────────────────────────────────────────────────────
export async function logIsmCall(enquiryId: string, outcome: string, notes?: string) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  const actorId = enquiry.assignedIsmId || session.user.id;

  // Update status to CALLED
  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: { status: "CALLED", lastUpdatedByRole: session.user.role, lastUpdatedByName: session.user.name || "ISM" },
  });

  await prisma.ismLeadActivity.create({
    data: {
      enquiryId,
      ismId: actorId,
      type: "CALL_LOGGED",
      content: `Call logged — Outcome: ${outcome}${notes ? `. Notes: ${notes}` : ""}`,
      meta: { outcome, notes },
    },
  });

  // 🔔 Notify Institute Managers
  const ismName = session.user.name || "Sales Manager";
  await notifyInstituteManagers(
    enquiry.instituteId,
    `📞 Call Logged on Lead`,
    `${ismName} logged a call with "${enquiry.name}". Outcome: ${outcome}${notes ? `. Notes: "${notes}"` : ""}.`,
    enquiryId,
    session.user.id
  );

  revalidateIsmPaths(enquiry, enquiry.assignedIsmId);
  return { success: true };
}

// ─── 5. Convert to Admission ──────────────────────────────────────────────────
export interface AdmissionInstallmentInput {
  amount: number;
  dueDate: string;
  note?: string;
}

export interface ConvertToAdmissionInput {
  courseName?: string;
  totalFee: number;
  admissionNote?: string;
  installments: AdmissionInstallmentInput[];
}

export async function convertToAdmission(
  enquiryId: string,
  data: ConvertToAdmissionInput
) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  const ismId = enquiry.assignedIsmId || session.user.id;

  // Check if already converted
  const existing = await prisma.admissionRecord.findUnique({ where: { enquiryId } });
  if (existing) return { success: false, error: "This lead has already been converted to admission." };

  // 1. Create admission record
  const admission = await prisma.admissionRecord.create({
    data: {
      enquiryId,
      instituteId: enquiry.instituteId,
      ismId,
      studentName: enquiry.name,
      courseName: data.courseName || null,
      totalFee: data.totalFee,
      paidAmount: 0,
      feeStatus: "PENDING",
      admissionNote: data.admissionNote || null,
      installments: {
        create: data.installments.map((inst: AdmissionInstallmentInput) => ({
          amount: inst.amount,
          dueDate: new Date(inst.dueDate),
          status: "UPCOMING",
          note: inst.note || null,
        })),
      },
    },
  });

  // 2. Mark enquiry as converted
  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: {
      convertedToAdmission: true,
      status: "APPROVED",
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "ISM",
    },
  });

  // 3. Log activity
  await prisma.ismLeadActivity.create({
    data: {
      enquiryId,
      ismId,
      type: "CONVERTED",
      content: `🎉 Lead converted to admission! Course: ${data.courseName || "N/A"}, Total Fee: ₹${data.totalFee.toLocaleString("en-IN")}`,
    },
  });

  // 4. Notify Institute Managers
  const ismName = session.user.name || "Sales Manager";
  await notifyInstituteManagers(
    enquiry.instituteId,
    "🎓 Lead Converted to Admission!",
    `${ismName} converted lead "${enquiry.name}" to admission${data.courseName ? ` for ${data.courseName}` : ""} (Fee: ₹${data.totalFee.toLocaleString("en-IN")})!`,
    enquiryId,
    session.user.id
  );

  revalidateIsmPaths(enquiry, ismId);
  revalidatePath(`/institute_sales/${enquiry.instituteId}/${ismId}/admissions`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads/${enquiryId}`);
  revalidatePath(`/manager/${enquiry.instituteId}/sales-team`);
  revalidatePath(`/manager/${enquiry.instituteId}/admissions`);
  return { success: true, admissionId: admission.id };
}

// ─── 6. Update installment payment status ─────────────────────────────────────
export async function markInstallmentPaid(installmentId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  const installment = await prisma.feeInstallment.findUnique({
    where: { id: installmentId },
    include: { admission: { include: { enquiry: { select: { instituteId: true, assignedIsmId: true } } } } },
  });
  if (!installment) return { success: false, error: "Installment not found." };

  const { admission } = installment;
  const isAuthorized =
    session.user.role === "ADMIN" ||
    admission.ismId === session.user.id ||
    !!(await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId: admission.instituteId } },
    }));

  if (!isAuthorized) return { success: false, error: "Not authorized." };

  await prisma.feeInstallment.update({
    where: { id: installmentId },
    data: { status: "PAID", paidDate: new Date() },
  });

  // Recalculate paidAmount on admission
  const allInstallments = await prisma.feeInstallment.findMany({ where: { admissionId: admission.id } });
  type FeeInstallmentDb = (typeof allInstallments)[number];
  const paidAmount = allInstallments
    .filter((i: FeeInstallmentDb) => i.status === "PAID" || i.id === installmentId)
    .reduce((sum: number, i: FeeInstallmentDb) => sum + i.amount, 0);
  const feeStatus = paidAmount >= admission.totalFee ? "PAID" : "PARTIAL";

  await prisma.admissionRecord.update({
    where: { id: admission.id },
    data: { paidAmount, feeStatus },
  });

  // 🔔 Notify Institute Managers
  const ismName = session.user.name || "Sales Manager";
  await notifyInstituteManagers(
    admission.instituteId,
    `💰 Fee Installment Collected!`,
    `${ismName} marked an installment of ₹${installment.amount.toLocaleString("en-IN")} as PAID for student "${admission.studentName}".`,
    admission.enquiryId,
    session.user.id
  );

  const ismId = admission.ismId;
  revalidatePath(`/institute_sales/${admission.instituteId}/${ismId}/admissions`);
  revalidatePath(`/institute_sales/${admission.instituteId}/${ismId}/admissions/${admission.id}`);
  revalidatePath(`/manager/${admission.instituteId}/sales-team`);
  return { success: true };
}
