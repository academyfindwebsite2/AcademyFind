import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser } from "@/lib/notifications/notify";
import type { NotificationType } from "@/app/generated/prisma/client";

async function notifyManagers(instituteId: string, title: string, body: string, enquiryId?: string, excludeUserId?: string) {
  try {
    const managers = await prisma.instituteManager.findMany({
      where: { instituteId },
      select: { userId: true },
    });
    for (const m of managers) {
      if (excludeUserId && m.userId === excludeUserId) continue;
      await notifyUser(m.userId, "SYSTEM" as NotificationType, title, body, enquiryId);
    }
  } catch (err) {
    console.warn("Failed to notify managers:", err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; leadId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId, leadId } = await params;

    const lead = await prisma.instituteEnquiry.findUnique({
      where: { id: leadId },
      include: {
        ismActivities: {
          include: {
            ism: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        admissionRecord: {
          include: {
            installments: { orderBy: { dueDate: "asc" } },
          },
        },
      },
    });

    if (!lead || lead.instituteId !== instituteId) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    // Verify user is assigned ISM, Manager, or Admin
    const isAssigned = lead.assignedIsmId === session.user.id;
    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!isAssigned && !isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        lead,
        canEditLead: !!isManager || session.user.role === "ADMIN",
      },
    });
  } catch (error: any) {
    console.error("Mobile ISM Lead Detail GET Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; leadId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId, leadId } = await params;
    const lead = await prisma.instituteEnquiry.findUnique({ where: { id: leadId } });

    if (!lead || lead.instituteId !== instituteId) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    const isAssigned = lead.assignedIsmId === session.user.id;
    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!isAssigned && !isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;
    const ismName = session.user.name || "Sales Manager";

    // 1. STATUS_UPDATE
    if (action === "STATUS_UPDATE") {
      const { status } = body;
      if (!status) return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 });

      const oldStatus = lead.status;
      await prisma.instituteEnquiry.update({
        where: { id: leadId },
        data: {
          status,
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: ismName,
        },
      });

      await prisma.ismLeadActivity.create({
        data: {
          enquiryId: leadId,
          ismId: session.user.id,
          type: "STATUS_CHANGED",
          content: `Status updated from ${oldStatus} to ${status}`,
          meta: { oldStatus, newStatus: status },
        },
      });

      await notifyManagers(
        instituteId,
        `📌 Lead Status Updated (${status})`,
        `${ismName} updated status of lead "${lead.name}" from ${oldStatus} to ${status}.`,
        leadId,
        session.user.id
      );

      return NextResponse.json({ success: true, message: `Status updated to ${status}` });
    }

    // 2. SCHEDULE_FOLLOWUP
    if (action === "SCHEDULE_FOLLOWUP") {
      const { nextFollowUp, followUpNote } = body;
      if (!nextFollowUp) return NextResponse.json({ success: false, error: "Follow-up date is required" }, { status: 400 });

      const dateObj = new Date(nextFollowUp);
      await prisma.instituteEnquiry.update({
        where: { id: leadId },
        data: {
          nextFollowUp: dateObj,
          followUpNote: followUpNote || null,
          status: "CONTACT_LATER",
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: ismName,
        },
      });

      await prisma.ismLeadActivity.create({
        data: {
          enquiryId: leadId,
          ismId: session.user.id,
          type: "FOLLOWUP_SET",
          content: `Follow-up scheduled for ${dateObj.toLocaleDateString("en-IN")}${followUpNote ? `: ${followUpNote}` : ""}`,
        },
      });

      await notifyManagers(
        instituteId,
        `📅 Follow-up Scheduled`,
        `${ismName} scheduled a follow-up for lead "${lead.name}" on ${dateObj.toLocaleDateString("en-IN")}${followUpNote ? `. Note: "${followUpNote}"` : ""}.`,
        leadId,
        session.user.id
      );

      return NextResponse.json({ success: true, message: "Follow-up scheduled" });
    }

    // 3. ADD_NOTE
    if (action === "ADD_NOTE") {
      const { note } = body;
      const trimmed = note?.trim();
      if (!trimmed) return NextResponse.json({ success: false, error: "Note cannot be empty" }, { status: 400 });

      await prisma.instituteEnquiry.update({
        where: { id: leadId },
        data: {
          ismNote: trimmed,
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: ismName,
        },
      });

      await prisma.ismLeadActivity.create({
        data: {
          enquiryId: leadId,
          ismId: session.user.id,
          type: "NOTE",
          content: trimmed,
        },
      });

      await notifyManagers(
        instituteId,
        `📝 New Lead Note Added`,
        `${ismName} added a note on lead "${lead.name}": "${trimmed}"`,
        leadId,
        session.user.id
      );

      return NextResponse.json({ success: true, message: "Note added" });
    }

    // 4. LOG_CALL
    if (action === "LOG_CALL") {
      const { outcome, notes } = body;
      if (!outcome) return NextResponse.json({ success: false, error: "Call outcome is required" }, { status: 400 });

      await prisma.instituteEnquiry.update({
        where: { id: leadId },
        data: {
          status: "CALLED",
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: ismName,
        },
      });

      await prisma.ismLeadActivity.create({
        data: {
          enquiryId: leadId,
          ismId: session.user.id,
          type: "CALL_LOGGED",
          content: `Call logged — Outcome: ${outcome}${notes ? `. Notes: ${notes}` : ""}`,
          meta: { outcome, notes },
        },
      });

      await notifyManagers(
        instituteId,
        `📞 Call Logged on Lead`,
        `${ismName} logged a call with "${lead.name}". Outcome: ${outcome}${notes ? `. Notes: "${notes}"` : ""}.`,
        leadId,
        session.user.id
      );

      return NextResponse.json({ success: true, message: "Call logged successfully" });
    }

    // 5. CONVERT_ADMISSION
    if (action === "CONVERT_ADMISSION") {
      const { courseName, totalFee, admissionNote, installments = [] } = body;
      if (!totalFee || isNaN(Number(totalFee))) {
        return NextResponse.json({ success: false, error: "Valid total fee is required" }, { status: 400 });
      }

      const existing = await prisma.admissionRecord.findUnique({ where: { enquiryId: leadId } });
      if (existing) {
        return NextResponse.json({ success: false, error: "Lead has already been converted to admission" }, { status: 400 });
      }

      const admission = await prisma.admissionRecord.create({
        data: {
          enquiryId: leadId,
          instituteId,
          ismId: session.user.id,
          studentName: lead.name,
          courseName: courseName || lead.course || null,
          totalFee: Number(totalFee),
          paidAmount: 0,
          feeStatus: "PENDING",
          admissionNote: admissionNote || null,
          installments: {
            create: installments.map((inst: any) => ({
              amount: Number(inst.amount) || 0,
              dueDate: new Date(inst.dueDate || Date.now()),
              status: "UPCOMING",
              note: inst.note || null,
            })),
          },
        },
      });

      await prisma.instituteEnquiry.update({
        where: { id: leadId },
        data: {
          convertedToAdmission: true,
          status: "CONVERTED",
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: ismName,
        },
      });

      await prisma.ismLeadActivity.create({
        data: {
          enquiryId: leadId,
          ismId: session.user.id,
          type: "CONVERTED",
          content: `🎉 Lead converted to admission! Course: ${courseName || lead.course || "N/A"}, Fee: ₹${Number(totalFee).toLocaleString("en-IN")}`,
        },
      });

      await notifyManagers(
        instituteId,
        "🎓 Lead Converted to Admission!",
        `${ismName} converted lead "${lead.name}" to admission (Fee: ₹${Number(totalFee).toLocaleString("en-IN")})!`,
        leadId,
        session.user.id
      );

      return NextResponse.json({ success: true, message: "Lead converted to admission!", data: admission });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Mobile ISM Lead Detail POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
