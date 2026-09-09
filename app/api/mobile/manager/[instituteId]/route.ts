import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { instituteId } = await params;

    // Verify manager access
    const manager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!manager) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Fetch dashboard data in parallel
    const [institute, totalLeads, newLeads, totalMembers, pendingMembers, recentLeads, todayViews, totalSaves, sumDailyViews] = await Promise.all([
      prisma.institute.findUnique({
        where: { id: instituteId },
        select: {
          id: true, name: true, slug: true, logo: true, gallery: true,
          averageRating: true, reviewCount: true, isVerified: true, isActive: true,
          subscriptionPlan: true, planExpiresAt: true, planWeight: true,
          viewCount: true,
          city: { select: { name: true } },
          _count: {
            select: {
              shortlistedBy: true,
              reviews: true,
              enquiries: true,
            },
          },
        },
      }),
      prisma.instituteEnquiry.count({ where: { instituteId } }),
      prisma.instituteEnquiry.count({ where: { instituteId, status: 'NEW' } }),
      prisma.instituteMembership.count({ where: { instituteId, status: 'ACTIVE', isActive: true } }),
      prisma.instituteMembership.count({ where: { instituteId, status: 'PENDING' } }),
      prisma.instituteEnquiry.findMany({
        where: { instituteId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.instituteDailyView.findFirst({
        where: { instituteId, date: new Date(new Date().toISOString().split('T')[0]) },
      }),
      prisma.userShortlist.count({ where: { instituteId } }),
      prisma.instituteDailyView.aggregate({
        where: { instituteId },
        _sum: { viewCount: true },
      }),
    ]);

    const savesCount = totalSaves || institute?._count?.shortlistedBy || 0;
    const allTimeViews = Math.max(institute?.viewCount || 0, sumDailyViews?._sum?.viewCount || 0);
    const viewsToday = todayViews?.viewCount || 0;

    return NextResponse.json({
      success: true,
      data: {
        institute,
        stats: {
          totalLeads,
          newLeads,
          totalMembers,
          pendingMembers,
          shortlistedBy: savesCount,
          shortlists: savesCount,
          totalViews: allTimeViews,
          todayViews: viewsToday,
        },
        recentLeads,
      },
    });
  } catch (error: any) {
    console.error('Error in mobile manager dashboard GET:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
