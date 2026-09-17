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

    const isAssigned = await prisma.instituteSalesManagerAssignment.findUnique({
      where: { userId_instituteId: { userId, instituteId } },
    });
    if (!isAssigned?.isActive && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [overdue, today, upcoming] = await Promise.all([
      // Overdue: nextFollowUp < todayStart
      prisma.instituteEnquiry.findMany({
        where: {
          instituteId,
          assignedIsmId: userId,
          nextFollowUp: { lt: todayStart },
          convertedToAdmission: false,
          status: { notIn: ["APPROVED", "CONVERTED", "JUNK"] },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          course: true,
          status: true,
          nextFollowUp: true,
          followUpNote: true,
        },
        orderBy: { nextFollowUp: "asc" },
      }),
      // Today: nextFollowUp between todayStart and todayEnd
      prisma.instituteEnquiry.findMany({
        where: {
          instituteId,
          assignedIsmId: userId,
          nextFollowUp: { gte: todayStart, lte: todayEnd },
          convertedToAdmission: false,
          status: { notIn: ["APPROVED", "CONVERTED", "JUNK"] },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          course: true,
          status: true,
          nextFollowUp: true,
          followUpNote: true,
        },
        orderBy: { nextFollowUp: "asc" },
      }),
      // Upcoming: nextFollowUp > todayEnd
      prisma.instituteEnquiry.findMany({
        where: {
          instituteId,
          assignedIsmId: userId,
          nextFollowUp: { gt: todayEnd },
          convertedToAdmission: false,
          status: { notIn: ["APPROVED", "CONVERTED", "JUNK"] },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          course: true,
          status: true,
          nextFollowUp: true,
          followUpNote: true,
        },
        orderBy: { nextFollowUp: "asc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        overdue,
        today,
        upcoming,
        counts: {
          overdue: overdue.length,
          today: today.length,
          upcoming: upcoming.length,
          total: overdue.length + today.length + upcoming.length,
        },
      },
    });
  } catch (error: any) {
    console.error("Mobile ISM Followups Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
