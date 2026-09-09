import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { notifyAdmins } from '@/lib/notifications/notify';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (session.user.role !== 'SALES_MANAGER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || session.user.id;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');

    const where: any = { salesManagerId: id };
    if (status && status !== 'ALL') {
      where.contactStatus = status;
    }

    const instituteWhere: any = {};
    if (search) {
      instituteWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { city: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (categoryId && categoryId !== 'ALL') {
      instituteWhere.categories = {
        some: { categoryId }
      };
    }
    if (Object.keys(instituteWhere).length > 0) {
      where.institute = instituteWhere;
    }

    const [assignments, assignedAreas, categories] = await Promise.all([
      prisma.salesAssignment.findMany({
        where,
        include: {
          institute: {
            select: {
              id: true,
              name: true,
              slug: true,
              email: true,
              phone: true,
              address: true,
              latitude: true,
              longitude: true,
              city: { select: { name: true } },
              categories: {
                include: { category: { select: { id: true, name: true } } },
                take: 2,
              },
            }
          },
          areaAssignment: {
            select: {
              id: true,
              areaName: true,
              radiusKm: true,
              latitude: true,
              longitude: true,
            }
          }
        },
        orderBy: [{ contactStatus: "asc" }, { deadline: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.salesAreaAssignment.findMany({
        where: { salesManagerId: id },
        select: {
          id: true,
          areaName: true,
          latitude: true,
          longitude: true,
          radiusKm: true,
          deadline: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    ]);

    return NextResponse.json({ success: true, data: assignments, areas: assignedAreas, categories });
  } catch (error: any) {
    console.error("Sales Assignments API Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || (session.user.role !== 'SALES_MANAGER' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { assignmentId, contactStatus, notes, remark, onboardedPlan } = await request.json();
    if (!assignmentId || !contactStatus) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const assignment = await prisma.salesAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || (assignment.salesManagerId !== session.user.id && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ success: false, error: 'Assignment not found or forbidden' }, { status: 403 });
    }

    const updateData: any = { contactStatus };
    if (remark !== undefined) updateData.remark = remark;
    else if (notes !== undefined) updateData.remark = notes;

    if (contactStatus === 'ONBOARDED' || contactStatus === 'UPGRADED') {
      updateData.interest = 'INTERESTED';
      updateData.onboardedPlan = onboardedPlan || 'PREMIUM';
      updateData.onboardedAt = assignment.onboardedAt || new Date();
      if (!assignment.contactedAt) updateData.contactedAt = new Date();
    } else if (contactStatus === 'CONTACTED' || contactStatus === 'MESSAGED' || contactStatus === 'CALLED' || contactStatus === 'IN_PROCESS') {
      updateData.contactedAt = assignment.contactedAt || new Date();
    }

    const updated = await prisma.salesAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        institute: { select: { name: true } },
        salesManager: { select: { id: true, name: true } }
      }
    });

    // 🔔 Notify Admins about the status update (notifyAdmins handles DB row and push notification)
    const managerName = updated.salesManager?.name || session.user.name || "Sales Manager";
    const instName = updated.institute?.name || "Institute";
    notifyAdmins(
      "SALES_ASSIGNMENT_UPDATE",
      `Sales Assignment Updated: ${instName}`,
      `${managerName} updated status to "${contactStatus}" for ${instName}.`,
      `/af-ass-manage/sales_manager/${updated.salesManagerId}`,
      updated.id
    ).catch(e => console.error("Admin notification error:", e));

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Sales Assignments PUT Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
