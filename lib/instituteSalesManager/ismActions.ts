"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser } from "@/lib/notifications/notify";
import type { NotificationType } from "@/app/generated/prisma/client";

// ─── 1. Add an ISM to an institute ──────────────────────────────────────────
export async function addIsmToInstitute(targetUserId: string, instituteId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  // Only institute manager (of this institute) or admin can add
  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "You are not authorized to manage this institute's sales team." };
  }

  // Target user must be INSTITUTE_SALES_MANAGER
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, name: true } });
  if (!targetUser) return { success: false, error: "User not found." };
  if (targetUser.role !== "INSTITUTE_SALES_MANAGER" && session.user.role !== "ADMIN") {
    return { success: false, error: "User must have the INSTITUTE_SALES_MANAGER role." };
  }

  const existing = await prisma.instituteSalesManagerAssignment.findUnique({
    where: { userId_instituteId: { userId: targetUserId, instituteId } },
  });

  if (existing) {
    // Reactivate if previously deactivated
    if (!existing.isActive) {
      await prisma.instituteSalesManagerAssignment.update({
        where: { userId_instituteId: { userId: targetUserId, instituteId } },
        data: { isActive: true, assignedById: session.user.id },
      });
      revalidatePath(`/manager/${instituteId}/sales-team`);
      return { success: true, message: "ISM reactivated." };
    }
    return { success: false, error: "This ISM is already assigned to this institute." };
  }

  await prisma.instituteSalesManagerAssignment.create({
    data: { userId: targetUserId, instituteId, assignedById: session.user.id },
  });

  // Notify the ISM
  const institute = await prisma.institute.findUnique({ where: { id: instituteId }, select: { name: true } });
  await notifyUser(
    targetUserId,
    "SYSTEM" as NotificationType,
    "🎯 Assigned as Institute Sales Manager",
    `You have been assigned as a Sales Manager for ${institute?.name || "an institute"}. Check your ISM dashboard to get started.`,
    instituteId,
  );

  revalidatePath(`/manager/${instituteId}/sales-team`);
  return { success: true, message: "ISM added to institute successfully." };
}

// ─── 2. Remove / deactivate an ISM from an institute ─────────────────────────
export async function removeIsmFromInstitute(targetUserId: string, instituteId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Not authorized." };
  }

  await prisma.instituteSalesManagerAssignment.update({
    where: { userId_instituteId: { userId: targetUserId, instituteId } },
    data: { isActive: false },
  });

  // Unassign all their active leads for this institute
  await prisma.instituteEnquiry.updateMany({
    where: { instituteId, assignedIsmId: targetUserId },
    data: { assignedIsmId: null },
  });

  revalidatePath(`/manager/${instituteId}/sales-team`);
  return { success: true };
}

// ─── 3. Assign a lead to an ISM (by institute manager) ───────────────────────
export async function assignLeadToIsm(enquiryId: string, ismUserId: string | null) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  const enquiry = await prisma.instituteEnquiry.findUnique({
    where: { id: enquiryId },
    include: { institute: { select: { name: true } } },
  });
  if (!enquiry) return { success: false, error: "Lead not found." };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId: enquiry.instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Not authorized to assign leads for this institute." };
  }

  const previousIsmId = enquiry.assignedIsmId;

  await prisma.instituteEnquiry.update({
    where: { id: enquiryId },
    data: {
      assignedIsmId: ismUserId || null,
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "Manager",
    },
  });

  // Log activity if assigning (not unassigning)
  if (ismUserId) {
    await prisma.ismLeadActivity.create({
      data: {
        enquiryId,
        ismId: ismUserId,
        type: "STATUS_CHANGED",
        content: `Lead assigned by ${session.user.name || "Institute Manager"}.`,
      },
    });

    // Notify the ISM
    await notifyUser(
      ismUserId,
      "SYSTEM" as NotificationType,
      "🎯 New Lead Assigned",
      `You have been assigned a new lead: ${enquiry.name} (${enquiry.phone}) for ${enquiry.institute?.name || "your institute"}.`,
      enquiryId,
    );
  }

  revalidatePath(`/manager/${enquiry.instituteId}/leads`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads/${enquiryId}`);
  revalidatePath(`/manager/${enquiry.instituteId}/sales-team`);
  if (ismUserId) {
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${ismUserId}/leads`);
  }
  if (previousIsmId) {
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${previousIsmId}/leads`);
  }

  return { success: true };
}

// ─── 4. Find ISM by email (for adding) ───────────────────────────────────────
export async function findIsmByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, image: true, role: true },
  });
  if (!user) return { success: false, error: "No user found with this email." };
  return { success: true, user };
}

// ─── 5. Bulk assign leads to an ISM ──────────────────────────────────────────
export async function bulkAssignLeadsToIsm(enquiryIds: string[], ismUserId: string | null) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };
  if (!enquiryIds.length) return { success: true, count: 0 };

  const first = await prisma.instituteEnquiry.findUnique({
    where: { id: enquiryIds[0] },
    select: { instituteId: true },
  });
  if (!first) return { success: false, error: "Lead not found." };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId: first.instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Unauthorized to manage leads for this institute." };
  }

  await prisma.instituteEnquiry.updateMany({
    where: { id: { in: enquiryIds } },
    data: {
      assignedIsmId: ismUserId || null,
      lastUpdatedByRole: session.user.role,
      lastUpdatedByName: session.user.name || "Manager",
    },
  });

  revalidatePath(`/manager/${first.instituteId}/leads`);
  revalidatePath(`/manager/${first.instituteId}/sales-team`);
  return { success: true, count: enquiryIds.length };
}
