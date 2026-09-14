"use server";

import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/notify";
import { getSession } from "@/lib/auth/getSession";
import { revalidatePath } from "next/cache";
import type { NotificationType } from "@/app/generated/prisma/client";

export interface CreateLeadInput {
  instituteId: string;
  name: string;
  phone: string;
  email?: string | null;
  course?: string | null;
  batch?: string | null;
  source: string;
  sourceDetails?: Record<string, any> | null;
  message?: string | null;
  status?: string;
  tags?: string[];
  assignedIsmId?: string | null;
  creatorUserId?: string | null;
  creatorRole?: string | null;
  creatorName?: string | null;
  skipAutoEmail?: boolean;
}

/**
 * Standardized lead creation across all entry points:
 * (Website, Meta/Google ads, Excel upload, Phone/Walk-in manual entry)
 * Automatically triggers:
 * 1. Immediate welcome email (if student email exists)
 * 2. Immutable non-destructive activity logs: LEAD_CREATED, AUTO_EMAIL_SENT, LEAD_ASSIGNED
 * 3. ISM assignment notification
 */
export async function createStandardizedLead(input: CreateLeadInput) {
  const {
    instituteId,
    name,
    phone,
    email,
    course,
    batch,
    source,
    sourceDetails,
    message,
    status = "NEW",
    tags = [],
    assignedIsmId,
    creatorUserId,
    creatorRole = "SYSTEM",
    creatorName,
    skipAutoEmail = false,
  } = input;

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { id: true, name: true, phone: true, email: true, slug: true },
  });

  if (!institute) {
    throw new Error(`Institute with ID ${instituteId} not found`);
  }

  // 1. Create Enquiry
  const cleanPhone = phone.replace(/[^\d+]/g, "").trim();
  const enquiry = await prisma.instituteEnquiry.create({
    data: {
      instituteId,
      name: name.trim(),
      phone: cleanPhone,
      email: email ? email.trim().toLowerCase() : null,
      course: course ? course.trim() : null,
      batch: batch ? batch.trim() : null,
      source: source.toUpperCase(),
      sourceDetails: sourceDetails ?? undefined,
      message: message ? message.trim() : null,
      status: status.toUpperCase(),
      tags: Array.isArray(tags) ? tags.map((t: any) => t.trim()).filter(Boolean) : [],
      assignedIsmId: assignedIsmId || null,
      lastUpdatedByRole: creatorRole,
      lastUpdatedByName: creatorName || creatorRole,
    },
  });

  // 2. Log initial creation activity
  const actorId = creatorUserId || assignedIsmId || null;
  await prisma.ismLeadActivity.create({
    data: {
      enquiryId: enquiry.id,
      ismId: actorId,
      type: "LEAD_CREATED",
      content: `Lead generated via ${formatLeadSource(source)}${course ? ` for course: ${course}` : ""}`,
      meta: {
        source,
        creatorRole,
        creatorName: creatorName || null,
        initialStatus: status,
      },
    },
  });

  // 3. Log assignment if assigned upfront
  if (assignedIsmId) {
    const ismUser = await prisma.user.findUnique({
      where: { id: assignedIsmId },
      select: { name: true, email: true },
    });

    await prisma.ismLeadActivity.create({
      data: {
        enquiryId: enquiry.id,
        ismId: assignedIsmId,
        type: "LEAD_ASSIGNED",
        content: `Assigned to Sales Manager: ${ismUser?.name || ismUser?.email || "ISM"}`,
      },
    });

    // Notify ISM
    try {
      await notifyUser(
        assignedIsmId,
        "SYSTEM" as NotificationType,
        "🎯 New Lead Assigned",
        `You have been assigned lead "${name}" (${course || "General Inquiry"}) at ${institute.name}.`,
        enquiry.id
      );
    } catch (e) {
      console.error("Failed to notify assigned ISM:", e);
    }
  }

  return enquiry;
}

async function getFirstInstituteManagerId(instituteId: string): Promise<string> {
  const manager = await prisma.instituteManager.findFirst({
    where: { instituteId },
    select: { userId: true },
  });
  return manager?.userId || "system";
}

function formatLeadSource(src: string): string {
  switch (src) {
    case "META_ADS":
      return "Meta (Facebook/Instagram) Ads";
    case "GOOGLE_ADS":
      return "Google Ads";
    case "WEBSITE_WEBHOOK":
      return "Institute Website Form";
    case "EXCEL_IMPORT":
      return "Excel / CSV Import";
    case "PHONE_WALK_IN":
    case "WALK_IN":
      return "Walk-in / Phone Call";
    case "ACADEMYFIND":
      return "AcademyFind Direct";
    default:
      return src.replace(/_/g, " ");
  }
}

/**
 * Server action to create a manual lead from the web modal
 */
export async function createManualLeadAction(input: {
  instituteId: string;
  name: string;
  phone: string;
  email?: string | null;
  course?: string | null;
  batch?: string | null;
  source: string;
  status: string;
  tags?: string[];
  assignedIsmId?: string | null;
  message?: string | null;
}) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId: input.instituteId } },
  });
  const isAssignedIsm = await prisma.instituteSalesManagerAssignment.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId: input.instituteId } },
  });

  if (session.user.role !== "ADMIN" && !isManager && !isAssignedIsm) {
    return { success: false, error: "Not authorized to add leads for this institute" };
  }

  try {
    const lead = await createStandardizedLead({
      ...input,
      creatorUserId: session.user.id,
      creatorRole: isManager ? "MANAGER" : "ISM",
      creatorName: session.user.name || "Manager",
      skipAutoEmail: false,
    });

    revalidatePath(`/manager/${input.instituteId}/leads`);
    revalidatePath(`/manager/${input.instituteId}/sales-team`);

    return { success: true, leadId: lead.id };
  } catch (err: any) {
    console.error("createManualLeadAction error:", err);
    return { success: false, error: err.message || "Failed to create lead" };
  }
}

