"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser, notifyAdmins } from "@/lib/notifications/notify";
import type { NotificationType } from "@/app/generated/prisma/client";

// ─── 1. Send ISM Invite (by institute manager) ───────────────────────────────
export async function sendIsmInvite(targetUserId: string, instituteId: string, message?: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  // Must be institute manager or admin
  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "You are not authorized to manage this institute's sales team." };
  }

  // Check if already an active ISM
  const alreadyIsm = await prisma.instituteSalesManagerAssignment.findUnique({
    where: { userId_instituteId: { userId: targetUserId, instituteId } },
  });
  if (alreadyIsm?.isActive) {
    return { success: false, error: "This user is already an active Sales Manager for this institute." };
  }

  // Check if already has a PENDING invite
  const pendingInvite = await prisma.ismInviteRequest.findFirst({
    where: { userId: targetUserId, instituteId, status: "PENDING" },
  });
  if (pendingInvite) {
    return { success: false, error: "An invite is already pending for this user." };
  }

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { name: true },
  });

  // Create invite
  const invite = await prisma.ismInviteRequest.create({
    data: {
      userId: targetUserId,
      instituteId,
      sentById: session.user.id,
      message: message?.trim() || null,
    },
  });

  // Notify the target user
  await notifyUser(
    targetUserId,
    "SYSTEM" as NotificationType,
    "🎯 Institute Sales Manager Invite",
    `${session.user.name || "An institute manager"} has invited you to become a Sales Manager for ${institute?.name || "an institute"}. Tap to view and respond.`,
    invite.id, // entityId = inviteId so we can link to it
  );

  revalidatePath(`/manager/${instituteId}/sales-team`);
  return { success: true, message: "Invite sent! Waiting for user to accept." };
}

// ─── 2. Accept ISM Invite (by the invited user) ───────────────────────────────
export async function acceptIsmInvite(inviteId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  const invite = await prisma.ismInviteRequest.findUnique({
    where: { id: inviteId },
    include: {
      institute: { select: { name: true } },
      sentBy: { select: { id: true, name: true } },
    },
  });

  if (!invite) return { success: false, error: "Invite not found." };
  if (invite.userId !== session.user.id) return { success: false, error: "This invite is not for you." };
  if (invite.status !== "PENDING") return { success: false, error: "This invite has already been responded to." };

  // 1. Update invite status
  await prisma.ismInviteRequest.update({
    where: { id: inviteId },
    data: { status: "ACCEPTED" },
  });

  // 2. Upgrade user role to INSTITUTE_SALES_MANAGER
  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "INSTITUTE_SALES_MANAGER" },
  });

  // 3. Create ISM assignment (upsert in case of re-invite after deactivation)
  await prisma.instituteSalesManagerAssignment.upsert({
    where: { userId_instituteId: { userId: session.user.id, instituteId: invite.instituteId } },
    create: {
      userId: session.user.id,
      instituteId: invite.instituteId,
      assignedById: invite.sentById,
      isActive: true,
    },
    update: {
      isActive: true,
      assignedById: invite.sentById,
    },
  });

  // 4. Notify the institute manager who sent the invite
  await notifyUser(
    invite.sentById,
    "SYSTEM" as NotificationType,
    "✅ ISM Invite Accepted!",
    `${session.user.name || "A user"} has accepted your Sales Manager invite for ${invite.institute?.name}. They are now part of your sales team!`,
    invite.instituteId,
  );

  // 5. Create admin notification
  await notifyAdmins(
    "ROLE_CHANGE",
    "New ISM Role Assigned",
    `${session.user.name || session.user.id} accepted an ISM invite and has been assigned as Institute Sales Manager for ${invite.institute?.name}.`,
    `/manager/${invite.instituteId}/sales-team`,
    invite.instituteId,
  );

  revalidatePath(`/manager/${invite.instituteId}/sales-team`);
  revalidatePath(`/ism-invite/${inviteId}`);
  return {
    success: true,
    instituteId: invite.instituteId,
    userId: session.user.id,
    message: `Welcome to the team! You are now a Sales Manager for ${invite.institute?.name}.`,
  };
}

// ─── 3. Decline ISM Invite (by the invited user) ─────────────────────────────
export async function declineIsmInvite(inviteId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized." };

  const invite = await prisma.ismInviteRequest.findUnique({
    where: { id: inviteId },
    include: {
      institute: { select: { name: true } },
      sentBy: { select: { id: true, name: true } },
    },
  });

  if (!invite) return { success: false, error: "Invite not found." };
  if (invite.userId !== session.user.id) return { success: false, error: "This invite is not for you." };
  if (invite.status !== "PENDING") return { success: false, error: "This invite has already been responded to." };

  await prisma.ismInviteRequest.update({
    where: { id: inviteId },
    data: { status: "DECLINED" },
  });

  // Notify the manager who sent it
  await notifyUser(
    invite.sentById,
    "SYSTEM" as NotificationType,
    "❌ ISM Invite Declined",
    `${session.user.name || "A user"} has declined your Sales Manager invite for ${invite.institute?.name}.`,
    invite.instituteId,
  );

  revalidatePath(`/ism-invite/${inviteId}`);
  return { success: true, message: "Invite declined." };
}

// ─── 4. Get pending invites for the current user ──────────────────────────────
export async function getMyPendingIsmInvites() {
  const session = await getSession();
  if (!session?.user) return [];

  return prisma.ismInviteRequest.findMany({
    where: { userId: session.user.id, status: "PENDING" },
    include: {
      institute: { select: { id: true, name: true, logo: true } },
      sentBy: { select: { name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
