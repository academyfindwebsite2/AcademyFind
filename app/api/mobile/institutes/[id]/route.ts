import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const institute = await prisma.institute.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        city: true,
        categories: {
          include: { category: true },
        },
        facilities: { orderBy: { order: 'asc' } },
        batches: { orderBy: { createdAt: 'desc' } },
        highlightStats: { orderBy: { order: 'asc' } },
        achievements: { orderBy: { year: 'desc' }, take: 10 },
        faqs: { orderBy: { order: 'asc' } },
        operatingHours: { orderBy: { dayOfWeek: 'asc' } },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        _count: {
          select: {
            reviews: true,
            memberships: { where: { status: 'ACTIVE', isActive: true } },
          },
        },
      },
    });

    if (!institute) {
      return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });
    }

    // Check Authorization header for mobile token session
    let hasUnlockedBasicFeatures = false;
    let hasUnlockedCommunity = false;

    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const sessionObj = await prisma.session.findFirst({
        where: { token, expiresAt: { gt: new Date() } },
      });
      if (sessionObj) userId = sessionObj.userId;
    }

    if (userId) {
      const contactUnlockTx = await prisma.walletTransaction.findFirst({
        where: {
          wallet: { userId },
          source: 'SEE_CONTACT_BASIC_INSTITUTE',
          referenceId: institute.id,
          type: 'DEBIT',
        },
      });
      if (contactUnlockTx) hasUnlockedBasicFeatures = true;

      const communityUnlockTx = await prisma.walletTransaction.findFirst({
        where: {
          wallet: { userId },
          source: 'SEE_COMMUNITY_BASIC_INSTITUTE',
          referenceId: institute.id,
          type: 'DEBIT',
        },
      });
      if (communityUnlockTx) hasUnlockedCommunity = true;
    }

    const plan = institute.subscriptionPlan || 'BASIC';
    const isLockedPlan = plan === 'BASIC' || plan === 'VERIFIED';
    const isContactLocked = isLockedPlan && !hasUnlockedBasicFeatures;
    const isCommunityLocked = isLockedPlan && !hasUnlockedCommunity;

    return NextResponse.json({
      success: true,
      data: {
        ...institute,
        subscriptionPlan: plan,
        isContactLocked,
        isCommunityLocked,
        hasUnlockedBasicFeatures,
        hasUnlockedCommunity,
      },
    });
  } catch (error: any) {
    console.error('Mobile Institute Detail API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
