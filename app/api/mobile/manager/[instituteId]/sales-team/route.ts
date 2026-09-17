import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser } from "@/lib/notifications/notify";
import type { NotificationType } from "@/app/generated/prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId } = await params;

    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const [ismAssignments, recentActivities] = await Promise.all([
      prisma.instituteSalesManagerAssignment.findMany({
        where: { instituteId, isActive: true },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ismLeadActivity.findMany({
        where: { enquiry: { instituteId } },
        include: {
          ism: { select: { id: true, name: true, email: true } },
          enquiry: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    // Calculate per-ISM metrics
    const team = await Promise.all(
      ismAssignments.map(async (assignment: any) => {
        const userId = assignment.userId;
        const [totalLeads, newLeads, followUps, converted] = await Promise.all([
          prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId } }),
          prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: { in: ["NEW", "PENDING"] } } }),
          prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "CONTACT_LATER" } }),
          prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, convertedToAdmission: true } }),
        ]);

        return {
          assignmentId: assignment.id,
          userId,
          user: assignment.user,
          assignedAt: assignment.createdAt,
          stats: { totalLeads, newLeads, followUps, converted },
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        team,
        recentActivities,
      },
    });
  } catch (error: any) {
    console.error("Mobile Manager Sales Team GET Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId } = await params;

    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // 1. ASSIGN LEADS
    if (action === "assign_leads") {
      const { leadIds, ismUserId } = body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return NextResponse.json({ success: false, error: "No leads selected" }, { status: 400 });
      }

      await prisma.instituteEnquiry.updateMany({
        where: { id: { in: leadIds }, instituteId },
        data: {
          assignedIsmId: ismUserId || null,
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: session.user.name || "Manager",
        },
      });

      // Log activity
      const ismUser = ismUserId ? await prisma.user.findUnique({ where: { id: ismUserId }, select: { name: true } }) : null;
      for (const leadId of leadIds) {
        await prisma.ismLeadActivity.create({
          data: {
            enquiryId: leadId,
            ismId: ismUserId || null,
            type: "NOTE",
            content: ismUserId ? `Assigned to Sales Manager: ${ismUser?.name || "Counselor"}` : "Unassigned from counselor",
          },
        }).catch(() => null);
      }

      // Notify the ISM if assigned
      if (ismUserId) {
        const inst = await prisma.institute.findUnique({ where: { id: instituteId }, select: { name: true } });
        await notifyUser(
          ismUserId,
          "SYSTEM" as NotificationType,
          `📥 ${leadIds.length} New Leads Assigned`,
          `${session.user.name || "Manager"} assigned ${leadIds.length} leads to you for ${inst?.name || "the institute"}.`
        );
      }

      return NextResponse.json({ success: true, message: `Successfully assigned ${leadIds.length} leads` });
    }

    // 2. ADD ISM TO INSTITUTE
    if (action === "add_ism") {
      const { targetUserId } = body;
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: "targetUserId is required" }, { status: 400 });
      }

      const existing = await prisma.instituteSalesManagerAssignment.findUnique({
        where: { userId_instituteId: { userId: targetUserId, instituteId } },
      });

      if (existing) {
        if (!existing.isActive) {
          await prisma.instituteSalesManagerAssignment.update({
            where: { id: existing.id },
            data: { isActive: true, assignedById: session.user.id },
          });
          return NextResponse.json({ success: true, message: "Sales Manager reactivated" });
        }
        return NextResponse.json({ success: false, error: "User is already assigned to this sales team" }, { status: 400 });
      }

      await prisma.instituteSalesManagerAssignment.create({
        data: {
          userId: targetUserId,
          instituteId,
          assignedById: session.user.id,
          isActive: true,
        },
      });

      const inst = await prisma.institute.findUnique({ where: { id: instituteId }, select: { name: true } });
      await notifyUser(
        targetUserId,
        "SYSTEM" as NotificationType,
        "🎯 Added as Institute Sales Manager",
        `You have been added as a Sales Manager for ${inst?.name || "an institute"}. Check your ISM portal.`
      );

      return NextResponse.json({ success: true, message: "Sales Manager added successfully" });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Mobile Manager Sales Team POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId } = await params;

    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "targetUserId is required" }, { status: 400 });
    }

    await prisma.instituteSalesManagerAssignment.update({
      where: { userId_instituteId: { userId: targetUserId, instituteId } },
      data: { isActive: false },
    });

    // Unassign active leads
    await prisma.instituteEnquiry.updateMany({
      where: { instituteId, assignedIsmId: targetUserId },
      data: { assignedIsmId: null },
    });

    return NextResponse.json({ success: true, message: "Sales Manager deactivated" });
  } catch (error: any) {
    console.error("Mobile Manager Sales Team DELETE Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
