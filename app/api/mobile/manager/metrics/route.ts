import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const instituteId = searchParams.get('instituteId');
    if (!instituteId) return NextResponse.json({ success: false, error: 'Institute ID missing' }, { status: 400 });

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        viewCount: true,
        _count: {
          select: {
            shortlistedBy: true,
            enquiries: true,
            reviews: true,
          }
        }
      }
    });

    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const isLocked = institute.subscriptionPlan === 'BASIC' || institute.subscriptionPlan === 'VERIFIED';
    if (isLocked) {
      return NextResponse.json({
        success: true,
        data: {
          isLocked: true,
          plan: institute.subscriptionPlan,
          instituteName: institute.name,
          stats: {
            totalViews: institute.viewCount || 0,
            shortlists: institute._count.shortlistedBy || 0,
            enquiries: institute._count.enquiries || 0,
            reviews: institute._count.reviews || 0
          },
          dailyViews: []
        }
      });
    }

    const rawDailyViews = await prisma.instituteDailyView.findMany({
      where: {
        instituteId,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { date: 'asc' }
    });

    const dailyViews = rawDailyViews.map((v: any) => ({
      date: v.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      views: v.viewCount
    }));

    const stats = {
      totalViews: institute.viewCount || 0,
      shortlists: institute._count.shortlistedBy || 0,
      enquiries: institute._count.enquiries || 0,
      reviews: institute._count.reviews || 0
    };

    return NextResponse.json({
      success: true,
      data: {
        isLocked: false,
        plan: institute.subscriptionPlan,
        instituteName: institute.name,
        stats,
        dailyViews
      }
    });
  } catch (error: any) {
    console.error('Manager Metrics API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
