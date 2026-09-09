import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (session.user.role !== 'SALES_MANAGER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || session.user.id;

    const [assignments, assignedAreas, assignedEnquiriesCount, assignedEnquiries] = await Promise.all([
      prisma.salesAssignment.findMany({
        where: { salesManagerId: id },
        include: {
          institute: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: { select: { name: true } },
              categories: {
                include: { category: { select: { name: true } } },
                take: 1,
              },
            }
          },
          areaAssignment: {
            select: {
              id: true,
              areaName: true,
              radiusKm: true,
            }
          }
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.salesAreaAssignment.findMany({
        where: { salesManagerId: id },
        include: {
          institutes: {
            select: {
              id: true,
              contactStatus: true,
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.instituteEnquiry.count({
        where: {
          assignedSalesManagerId: id,
          isForwarded: false,
        }
      }),
      prisma.instituteEnquiry.findMany({
        where: {
          assignedSalesManagerId: id,
          isForwarded: false,
        },
        include: {
          institute: {
            select: {
              id: true,
              name: true,
              phone: true,
              slug: true,
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    ]);

    const now = new Date();

    const total = assignments.length;
    const notContacted = assignments.filter((a: any) => a.contactStatus === "NOT_CONTACTED").length;
    const messaged = assignments.filter((a: any) => a.contactStatus === "MESSAGED").length;
    const called = assignments.filter((a: any) => a.contactStatus === "CALLED").length;
    const contacted = assignments.filter((a: any) => a.contactStatus === "CONTACTED").length;
    const onboarded = assignments.filter((a: any) => a.contactStatus === "ONBOARDED").length;
    const upgraded = assignments.filter((a: any) => a.contactStatus === "UPGRADED").length;
    const overdue = assignments.filter((a: any) =>
      a.deadline && new Date(a.deadline) < now && a.contactStatus !== "ONBOARDED" && a.contactStatus !== "UPGRADED"
    ).length;

    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = assignments
      .filter((a: any) =>
        a.deadline &&
        new Date(a.deadline) >= now &&
        new Date(a.deadline) <= sevenDaysLater &&
        a.contactStatus !== "ONBOARDED" &&
        a.contactStatus !== "UPGRADED"
      )
      .sort((a: any, b: any) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

    // Process assigned areas with statistics
    const processedAreas = assignedAreas.map((area: any) => {
      const totalInstitutes = area.institutes?.length || 0;
      const onboardedCount = area.institutes?.filter((i: any) => i.contactStatus === 'ONBOARDED').length || 0;
      const contactedCount = area.institutes?.filter((i: any) => i.contactStatus === 'CONTACTED').length || 0;
      const pendingCount = area.institutes?.filter((i: any) => i.contactStatus === 'NOT_CONTACTED' || !i.contactStatus).length || 0;
      const percentage = totalInstitutes > 0 ? Math.round((onboardedCount / totalInstitutes) * 100) : 0;

      return {
        id: area.id,
        areaName: area.areaName,
        radiusKm: area.radiusKm,
        totalInstitutes,
        onboardedCount,
        contactedCount,
        pendingCount,
        percentage,
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        stats: {
          total,
          notContacted,
          messaged,
          called,
          contacted,
          onboarded,
          upgraded,
          overdue,
          callbacksCount: assignedEnquiriesCount,
        },
        upcomingDeadlines,
        assignedAreas: processedAreas,
        assignedEnquiries,
        assignedEnquiriesCount,
        recentActivity: assignments.slice(0, 5)
      } 
    });
  } catch (error: any) {
    console.error("Sales Dashboard API Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
