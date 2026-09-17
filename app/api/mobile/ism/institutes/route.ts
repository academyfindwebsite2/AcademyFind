import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const assignments = await prisma.instituteSalesManagerAssignment.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        institute: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            phone: true,
            email: true,
            address: true,
            city: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const institutes = assignments.map((a: any) => ({
      assignmentId: a.id,
      instituteId: a.instituteId,
      assignedAt: a.createdAt,
      institute: a.institute,
    }));

    return NextResponse.json({
      success: true,
      data: {
        total: institutes.length,
        institutes,
      },
    });
  } catch (error: any) {
    console.error("Mobile ISM Institutes Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
