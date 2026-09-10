import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser } from "@/lib/notifications/notify";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") throw new Error("Admin access required");
  return session;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET: Fetch all sales assignment requests with filtering & search
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const type = searchParams.get("type") || "ALL";
    const search = searchParams.get("search") || "";

    const where: any = {};
    if (status !== "ALL") where.status = status;
    if (type !== "ALL") where.type = type;

    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { salesManager: { name: { contains: q, mode: "insensitive" } } },
        { salesManager: { email: { contains: q, mode: "insensitive" } } },
        { institute: { name: { contains: q, mode: "insensitive" } } },
        { areaName: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [requests, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.salesAssignmentRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          institute: {
            select: {
              id: true,
              name: true,
              slug: true,
              address: true,
              subscriptionPlan: true,
              city: { select: { name: true } },
              categories: { select: { category: { select: { name: true } } }, take: 2 },
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          salesManager: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
            },
          },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.salesAssignmentRequest.count({ where }),
      prisma.salesAssignmentRequest.count({ where: { status: "PENDING" } }),
      prisma.salesAssignmentRequest.count({ where: { status: "APPROVED" } }),
      prisma.salesAssignmentRequest.count({ where: { status: "REJECTED" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        requests,
        total,
        pendingCount,
        approvedCount,
        rejectedCount,
      },
    });
  } catch (error: any) {
    const statusCode = error.message === "Unauthorized" ? 401 : error.message === "Admin access required" ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status: statusCode });
  }
}

// PUT / POST: Approve or Reject a sales assignment request
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await req.json();
    const { requestId, id, action, adminRemark, deadline, includeReassign } = body;
    const targetRequestId = requestId || id;

    if (!targetRequestId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Request ID and valid action (APPROVE or REJECT) are required" },
        { status: 400 }
      );
    }

    const requestItem = await prisma.salesAssignmentRequest.findUnique({
      where: { id: targetRequestId },
      include: {
        institute: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        salesManager: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!requestItem) {
      return NextResponse.json({ success: false, error: "Assignment request not found" }, { status: 404 });
    }

    if (requestItem.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: `Request is already ${requestItem.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const smId = requestItem.salesManagerId;
    const deadlineDate = deadline ? new Date(deadline) : null;
    let assignmentResult: any = null;

    if (action === "APPROVE") {
      if (requestItem.type === "INSTITUTE") {
        if (!requestItem.instituteId) {
          return NextResponse.json({ success: false, error: "Request is missing institute ID" }, { status: 400 });
        }

        assignmentResult = await prisma.salesAssignment.upsert({
          where: { instituteId: requestItem.instituteId },
          update: {
            salesManagerId: smId,
            deadline: deadlineDate,
            contactStatus: "NOT_CONTACTED",
          },
          create: {
            salesManagerId: smId,
            instituteId: requestItem.instituteId,
            deadline: deadlineDate,
            contactStatus: "NOT_CONTACTED",
          },
        });
      } else if (requestItem.type === "AREA") {
        const lat = requestItem.latitude;
        const lng = requestItem.longitude;
        const radiusKm = requestItem.radiusKm || 3;
        const areaName = requestItem.areaName || "Assigned Area";

        if (lat === null || lng === null) {
          return NextResponse.json({ success: false, error: "Request is missing area coordinates" }, { status: 400 });
        }

        const areaAssignment = await prisma.salesAreaAssignment.create({
          data: {
            salesManagerId: smId,
            areaName,
            latitude: lat,
            longitude: lng,
            radiusKm,
            deadline: deadlineDate,
          },
        });

        const institutesWithCoords = await prisma.institute.findMany({
          where: { latitude: { not: null }, longitude: { not: null }, isActive: true },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            salesAssignments: { select: { salesManagerId: true } },
          },
        });

        const inRadius = institutesWithCoords.filter(
          (i) => haversineKm(lat, lng, i.latitude!, i.longitude!) <= radiusKm
        );

        const addressMatches: any[] = areaName
          ? await prisma.institute.findMany({
              where: {
                isActive: true,
                OR: [{ latitude: null }, { longitude: null }],
                address: { contains: areaName, mode: "insensitive" },
              },
              select: {
                id: true,
                salesAssignments: { select: { salesManagerId: true } },
              },
            })
          : [];

        const seen = new Set(inRadius.map((i) => i.id));
        const allCandidates = [
          ...inRadius,
          ...addressMatches.filter((i) => !seen.has(i.id)),
        ];

        let assignedCount = 0;
        for (const inst of allCandidates) {
          const existing = (inst as any).salesAssignments;
          if (!existing || existing.salesManagerId === smId || includeReassign) {
            await prisma.salesAssignment.upsert({
              where: { instituteId: inst.id },
              update: {
                salesManagerId: smId,
                areaAssignmentId: areaAssignment.id,
                deadline: deadlineDate,
              },
              create: {
                salesManagerId: smId,
                instituteId: inst.id,
                areaAssignmentId: areaAssignment.id,
                deadline: deadlineDate,
                contactStatus: "NOT_CONTACTED",
              },
            });
            assignedCount++;
          }
        }

        assignmentResult = { areaAssignmentId: areaAssignment.id, assignedCount };
      } else if (requestItem.type === "CATEGORY") {
        if (!requestItem.categoryId) {
          return NextResponse.json({ success: false, error: "Request is missing category ID" }, { status: 400 });
        }

        assignmentResult = await prisma.salesCategoryAssignment.upsert({
          where: {
            salesManagerId_categoryId: {
              salesManagerId: smId,
              categoryId: requestItem.categoryId,
            },
          },
          update: {},
          create: {
            salesManagerId: smId,
            categoryId: requestItem.categoryId,
          },
        });
      }
    }

    const updatedRequest = await prisma.salesAssignmentRequest.update({
      where: { id: requestId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        adminRemark: adminRemark || null,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
      include: {
        institute: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        salesManager: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    try {
      const isApproved = action === "APPROVE";
      const targetDesc =
        requestItem.type === "INSTITUTE"
          ? requestItem.institute?.name || "Institute"
          : requestItem.type === "AREA"
          ? `Area: ${requestItem.areaName} (${requestItem.radiusKm || 3} km)`
          : `Category: ${requestItem.category?.name || "Category"}`;

      await notifyUser(
        smId,
        "SYSTEM",
        isApproved ? "Request Approved! 🎉" : "Request Declined",
        isApproved
          ? `Your assignment request for "${targetDesc}" has been approved.${adminRemark ? ` Admin Note: ${adminRemark}` : ""}`
          : `Your assignment request for "${targetDesc}" was not approved.${adminRemark ? ` Reason: ${adminRemark}` : ""}`,
        requestId
      );
    } catch (notifErr) {
      console.warn("Notification dispatch failed (non-critical):", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Request successfully ${action === "APPROVE" ? "approved" : "rejected"}`,
      data: {
        request: updatedRequest,
        assignmentResult,
      },
    });
  } catch (error: any) {
    console.error("Admin Sales Request Action Error:", error);
    const statusCode = error.message === "Unauthorized" ? 401 : error.message === "Admin access required" ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status: statusCode });
  }
}
