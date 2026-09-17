import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";

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
    const userId = session.user.id;

    // Verify ISM assignment or Admin
    const isAssigned = await prisma.instituteSalesManagerAssignment.findUnique({
      where: { userId_instituteId: { userId, instituteId } },
    });
    if (!isAssigned?.isActive && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Not authorized as an ISM for this institute" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      institute,
      totalLeads,
      newLeads,
      contactedLeads,
      followUpLeads,
      convertedLeads,
      overdueFollowUpsCount,
      dueTodayFollowUpsCount,
      recentLeads,
      urgentFollowUps,
      admissionsCount,
    ] = await Promise.all([
      prisma.institute.findUnique({
        where: { id: instituteId },
        select: { id: true, name: true, slug: true, phone: true, email: true, logo: true },
      }),
      prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId } }),
      prisma.instituteEnquiry.count({
        where: { instituteId, assignedIsmId: userId, status: { in: ["NEW", "PENDING"] } },
      }),
      prisma.instituteEnquiry.count({
        where: { instituteId, assignedIsmId: userId, status: { in: ["MESSAGED", "CALLED", "CONTACTED"] } },
      }),
      prisma.instituteEnquiry.count({
        where: { instituteId, assignedIsmId: userId, status: "CONTACT_LATER" },
      }),
      prisma.instituteEnquiry.count({
        where: { instituteId, assignedIsmId: userId, convertedToAdmission: true },
      }),
      prisma.instituteEnquiry.count({
        where: {
          instituteId,
          assignedIsmId: userId,
          nextFollowUp: { lt: todayStart },
          convertedToAdmission: false,
          status: { notIn: ["APPROVED", "JUNK"] },
        },
      }),
      prisma.instituteEnquiry.count({
        where: {
          instituteId,
          assignedIsmId: userId,
          nextFollowUp: { gte: todayStart, lte: todayEnd },
          convertedToAdmission: false,
        },
      }),
      prisma.instituteEnquiry.findMany({
        where: { instituteId, assignedIsmId: userId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          course: true,
          batch: true,
          status: true,
          source: true,
          nextFollowUp: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.instituteEnquiry.findMany({
        where: {
          instituteId,
          assignedIsmId: userId,
          nextFollowUp: { lte: todayEnd },
          convertedToAdmission: false,
          status: { notIn: ["APPROVED", "JUNK"] },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          course: true,
          status: true,
          nextFollowUp: true,
          followUpNote: true,
        },
        orderBy: { nextFollowUp: "asc" },
        take: 10,
      }),
      prisma.admissionRecord.count({ where: { instituteId, ismId: userId } }),
    ]);

    if (!institute) {
      return NextResponse.json({ success: false, error: "Institute not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        institute,
        stats: {
          totalLeads,
          newLeads,
          contactedLeads,
          followUpLeads,
          convertedLeads,
          overdueFollowUps: overdueFollowUpsCount,
          dueTodayFollowUps: dueTodayFollowUpsCount,
          totalAdmissions: admissionsCount,
        },
        urgentFollowUps,
        recentLeads,
      },
    });
  } catch (error: any) {
    console.error("Mobile ISM Dashboard Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
