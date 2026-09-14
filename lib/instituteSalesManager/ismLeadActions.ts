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
      status: "CONTACT_LATER",
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

// ─── 7. Update Lead Attributes (Course, Batch, Tags) ───────────────────────────
export async function updateLeadAttributes(
  enquiryId: string,
  data: { course?: string | null; batch?: string | null; tags?: string[] }
) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  // Only Institute Manager or Admin can edit lead attributes
  const isManager =
    session.user.role === "ADMIN" ||
    !!(await prisma.instituteManager.findUnique({
      where: {
        userId_instituteId: {
          userId: session.user.id,
          instituteId: enquiry.instituteId,
        },
      },
    }));

  if (!isManager) {
    return {
      success: false,
      error: "Permission denied: Only Institute Managers can edit lead attributes. Sales Managers are not authorized.",
    };
  }

  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: {
      ...(data.course !== undefined ? { course: data.course?.trim() || null } : {}),
      ...(data.batch !== undefined ? { batch: data.batch?.trim() || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
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
      content: `Lead attributes updated: Course="${data.course || "N/A"}", Batch="${data.batch || "N/A"}", Tags=[${(data.tags || []).join(", ")}]`,
    },
  });

  revalidateIsmPaths(enquiry, enquiry.assignedIsmId);
  return { success: true };
}

// ─── 8. Bulk Update Lead Status ───────────────────────────────────────────────
export async function bulkUpdateLeadStatus(
  instituteId: string,
  leadIds: string[],
  newStatus: string
) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Not authorized" };
  }

  await prisma.instituteEnquiry.updateMany({
    where: { id: { in: leadIds }, instituteId },
    data: {
      status: newStatus,
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "Manager",
    },
  });

  // Log activity for each
  for (const leadId of leadIds) {
    await prisma.ismLeadActivity.create({
      data: {
        enquiryId: leadId,
        ismId: session.user.id,
        type: "STATUS_CHANGED",
        content: `Bulk status update to: ${newStatus}`,
      },
    }).catch(() => null);
  }

  revalidatePath(`/manager/${instituteId}/leads`);
  return { success: true, count: leadIds.length };
}

// ─── 9. Full Lead Edit (Name, Phone, Email, Course, Batch, Source, Status, Assignment, Tags) ───
export interface UpdateLeadFullDetailsInput {
  name: string;
  phone: string;
  email?: string | null;
  course?: string | null;
  batch?: string | null;
  source?: string;
  status?: string;
  assignedIsmId?: string | null;
  tags?: string[];
}

export async function updateLeadFullDetails(
  enquiryId: string,
  data: UpdateLeadFullDetailsInput
) {
  const { error, session, enquiry } = await verifyIsmAccess(enquiryId);
  if (error || !session || !enquiry) return { success: false, error };

  // Strict Role Check: Only Institute Manager or Admin can edit lead profile details
  // Institute Sales Managers (ISM) are NOT authorized to edit leads
  const isManager =
    session.user.role === "ADMIN" ||
    !!(await prisma.instituteManager.findUnique({
      where: {
        userId_instituteId: {
          userId: session.user.id,
          instituteId: enquiry.instituteId,
        },
      },
    }));

  if (!isManager) {
    return {
      success: false,
      error: "Permission denied: Only Institute Managers can edit lead details. Sales Managers are not authorized to edit leads.",
    };
  }

  const cleanName = data.name.trim();
  if (!cleanName) return { success: false, error: "Student name is required" };

  const cleanPhone = data.phone.trim().replace(/\D/g, "");
  if (cleanPhone.length < 10) return { success: false, error: "Please provide a valid 10-digit phone number" };

  const oldValues = {
    name: enquiry.name,
    phone: enquiry.phone,
    email: enquiry.email,
    course: enquiry.course,
    batch: enquiry.batch,
    source: enquiry.source,
    status: enquiry.status,
    assignedIsmId: enquiry.assignedIsmId,
  };

  const updated = await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: {
      name: cleanName,
      phone: cleanPhone,
      email: data.email?.trim() || null,
      course: data.course?.trim() || null,
      batch: data.batch?.trim() || null,
      ...(data.source ? { source: data.source } : {}),
      ...(data.status ? { status: data.status } : {}),
      assignedIsmId: data.assignedIsmId !== undefined ? (data.assignedIsmId || null) : enquiry.assignedIsmId,
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "Manager",
    },
  });

  // Describe changes for immutable activity history
  const changes: string[] = [];
  if (oldValues.name !== cleanName) changes.push(`Name: "${oldValues.name}" → "${cleanName}"`);
  if (oldValues.phone !== cleanPhone) changes.push(`Phone: "${oldValues.phone}" → "${cleanPhone}"`);
  if (oldValues.email !== (data.email?.trim() || null)) changes.push(`Email updated`);
  if (oldValues.course !== (data.course?.trim() || null)) changes.push(`Course: "${oldValues.course || "N/A"}" → "${data.course || "N/A"}"`);
  if (oldValues.batch !== (data.batch?.trim() || null)) changes.push(`Batch: "${oldValues.batch || "N/A"}" → "${data.batch || "N/A"}"`);
  if (data.status && oldValues.status !== data.status) changes.push(`Status: ${oldValues.status} → ${data.status}`);
  if (data.assignedIsmId !== undefined && oldValues.assignedIsmId !== (data.assignedIsmId || null)) {
    changes.push(`Assignment updated`);
  }

  const actorId = enquiry.assignedIsmId || session.user.id;
  await prisma.ismLeadActivity.create({
    data: {
      enquiryId,
      ismId: actorId,
      type: "NOTE",
      content: `Lead details updated: ${changes.length > 0 ? changes.join(", ") : "Profile details saved"}`,
      meta: {
        actorId: session.user.id,
        actorName: session.user.name || "Manager",
        changes,
      },
    },
  });

  revalidateIsmPaths(enquiry, updated.assignedIsmId);
  revalidatePath(`/manager/${enquiry.instituteId}/leads`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads/${enquiryId}`);
  return { success: true, lead: updated };
}

