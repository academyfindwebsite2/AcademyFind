import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      assignmentId,
      assignmentIds,
      type,
      deleteLinkedInstitutes = true,
      salesManagerId,
    } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Type is required ('institute', 'category', 'area', 'bulk_institutes', or 'all')" },
        { status: 400 }
      );
    }

    // 1. Bulk Institutes Removal (Selected items)
    if (type === "bulk_institutes") {
      if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
        return NextResponse.json({ error: "assignmentIds array is required for bulk_institutes" }, { status: 400 });
      }

      const result = await prisma.salesAssignment.deleteMany({
        where: {
          OR: [
            { id: { in: assignmentIds } },
            { instituteId: { in: assignmentIds } },
          ],
        },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: `Successfully removed ${result.count} institute assignment(s).`,
      });
    }

    // 2. Single Institute Assignment Removal
    if (type === "institute") {
      if (!assignmentId) {
        return NextResponse.json({ error: "assignmentId is required for institute" }, { status: 400 });
      }

      // Safe delete: works whether assignmentId is SalesAssignment.id or Institute.id
      const result = await prisma.salesAssignment.deleteMany({
        where: {
          OR: [
            { id: assignmentId },
            { instituteId: assignmentId },
          ],
        },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: "Institute assignment removed.",
      });
    }

    // 3. Category Assignment Removal
    if (type === "category") {
      if (!assignmentId) {
        return NextResponse.json({ error: "assignmentId is required for category" }, { status: 400 });
      }

      const result = await prisma.salesCategoryAssignment.deleteMany({
        where: {
          OR: [
            { id: assignmentId },
            { categoryId: assignmentId },
          ],
        },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: "Category assignment removed.",
      });
    }

    // 4. Area Assignment Removal (Whole area or unlinking)
    if (type === "area") {
      if (!assignmentId) {
        return NextResponse.json({ error: "assignmentId is required for area" }, { status: 400 });
      }

      if (deleteLinkedInstitutes) {
        // Delete all institute assignments that were created under this area
        await prisma.salesAssignment.deleteMany({
          where: { areaAssignmentId: assignmentId },
        });
      }

      const result = await prisma.salesAreaAssignment.deleteMany({
        where: { id: assignmentId },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: deleteLinkedInstitutes
          ? "Area and all its assigned institutes removed."
          : "Area assignment removed (institutes retained as individual assignments).",
      });
    }

    // 5. Delete ALL Assignments of a Sales Manager (Complete Reset)
    if (type === "all") {
      if (!salesManagerId) {
        return NextResponse.json({ error: "salesManagerId is required to delete all assignments" }, { status: 400 });
      }

      const [instResult, areaResult, catResult] = await Promise.all([
        prisma.salesAssignment.deleteMany({
          where: { salesManagerId },
        }),
        prisma.salesAreaAssignment.deleteMany({
          where: { salesManagerId },
        }),
        prisma.salesCategoryAssignment.deleteMany({
          where: { salesManagerId },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Completely removed all assignments (${instResult.count} institutes, ${areaResult.count} areas, ${catResult.count} categories).`,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Error removing assignment:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
