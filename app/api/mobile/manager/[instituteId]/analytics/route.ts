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

    // Verify manager authorization
    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
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

    if (!institute) {
      return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });
    }

    // Plan Gating: Locked for BASIC and VERIFIED (Ultra / Premium required)
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
            reviews: institute._count.reviews || 0,
          },
          cityData: [],
          deviceData: [],
          avgDuration: 0,
          shortlistedBy: [],
          viewHistory: [],
        }
      });
    }

    // Last 30 days raw data and audience details
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      dailyViews,
      visits,
      enquiryStats,
      reviewStats,
      shortlistedBy,
      viewHistory,
    ] = await Promise.all([
      prisma.instituteDailyView.findMany({
        where: { instituteId, date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' },
      }),
      prisma.instituteVisit.findMany({
        where: { instituteId },
        select: { city: true, deviceType: true, duration: true },
        take: 1000,
      }),
      prisma.instituteEnquiry.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: true,
      }),
      prisma.review.aggregate({
        where: { instituteId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.userShortlist.findMany({
        where: { instituteId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true, username: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.userHistory.findMany({
        where: { instituteId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true, username: true } }
        },
        orderBy: { viewedAt: 'desc' },
        take: 50,
      }),
    ]);

    // Calculate average duration (in seconds)
    const validVisitsWithDuration = visits.filter((v: any) => typeof v.duration === 'number' && v.duration > 0);
    const avgDuration = validVisitsWithDuration.length > 0
      ? Math.round(validVisitsWithDuration.reduce((acc: number, curr: any) => acc + curr.duration, 0) / validVisitsWithDuration.length)
      : 0;

    // Aggregate Device data
    const deviceMap: Record<string, number> = {};
    visits.forEach((v: any) => {
      const dev = v.deviceType || 'Mobile';
      deviceMap[dev] = (deviceMap[dev] || 0) + 1;
    });
    const totalVisits = visits.length || 1;
    const deviceData = Object.keys(deviceMap)
      .map(k => ({
        name: k,
        value: deviceMap[k],
        percentage: Math.round((deviceMap[k] / totalVisits) * 100)
      }))
      .sort((a, b) => b.value - a.value);

    // Aggregate City data
    const cityMap: Record<string, number> = {};
    visits.forEach((v: any) => {
      const city = v.city && v.city !== 'Unknown' ? v.city : 'Direct / Local';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });
    const cityData = Object.keys(cityMap)
      .map(k => ({
        name: k,
        value: cityMap[k],
        percentage: Math.round((cityMap[k] / totalVisits) * 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 cities

    return NextResponse.json({
      success: true,
      data: {
        isLocked: false,
        plan: institute.subscriptionPlan,
        instituteName: institute.name,
        stats: {
          totalViews: institute.viewCount || visits.length || 0,
          shortlists: institute._count.shortlistedBy || 0,
          enquiries: institute._count.enquiries || 0,
          reviews: institute._count.reviews || 0,
        },
        avgDuration,
        deviceData,
        cityData,
        dailyViews: dailyViews.map((v: any) => ({
          date: v.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
          views: v.viewCount,
        })),
        enquiryStats,
        reviewStats: {
          averageRating: reviewStats._avg.rating || 0,
          totalReviews: reviewStats._count.rating || 0,
        },
        shortlistedBy,
        viewHistory,
      },
    });
  } catch (error: any) {
    console.error('Manager Analytics API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
