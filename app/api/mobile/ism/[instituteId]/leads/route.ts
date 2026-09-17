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
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "ALL";
    const searchQuery = searchParams.get("search")?.trim() || "";

    const whereClause: any = {
      instituteId,
      assignedIsmId: userId,
    };

    if (statusParam !== "ALL") {
      if (statusParam === "NEW") {
        whereClause.status = { in: ["NEW", "PENDING"] };
      } else {
        whereClause.status = statusParam;
      }
    }

    if (searchQuery) {
      whereClause.OR = [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { phone: { contains: searchQuery } },
        { email: { contains: searchQuery, mode: "insensitive" } },
        { course: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    const [leads, counts] = await Promise.all([
      prisma.instituteEnquiry.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          course: true,
          batch: true,
          tags: true,
          status: true,
          source: true,
          message: true,
          ismNote: true,
          nextFollowUp: true,
          followUpNote: true,
          convertedToAdmission: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      Promise.all([
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: { in: ["NEW", "PENDING"] } } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "MESSAGED" } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "CALLED" } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "CONTACT_LATER" } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: { in: ["APPROVED", "CONVERTED"] } } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "DNP" } }),
        prisma.instituteEnquiry.count({ where: { instituteId, assignedIsmId: userId, status: "JUNK" } }),
      ]),
    ]);

    const [total, countNew, countMessaged, countCalled, countFollowup, countConverted, countDnp, countJunk] = counts;

    return NextResponse.json({
      success: true,
      data: {
        leads,
        counts: {
          ALL: total,
          NEW: countNew,
          MESSAGED: countMessaged,
          CALLED: countCalled,
          CONTACT_LATER: countFollowup,
          CONVERTED: countConverted,
          DNP: countDnp,
          JUNK: countJunk,
        },
      },
    });
  } catch (error: any) {
    console.error("Mobile ISM Leads Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
