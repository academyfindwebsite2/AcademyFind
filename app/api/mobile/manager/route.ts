import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Common select definition to ensure exact parity
    const instituteSelect = {
      id: true,
      name: true,
      slug: true,
      logo: true,
      imageUrl: true,
      gallery: true,
      averageRating: true,
      reviewCount: true,
      isVerified: true,
      isActive: true,
      isPublished: true,
      subscriptionPlan: true,
      planExpiresAt: true,
      planWeight: true,
      city: { select: { name: true } },
      _count: {
        select: {
          enquiries: { where: { status: 'NEW' as const } },
          inboundLeads: { where: { status: 'NEW' as const } },
          memberships: { where: { status: 'PENDING' as const } },
          batches: { where: { isActive: true } },
        },
      },
    };

    // If user is ADMIN, allow managing ALL institutes (exact parity with Web Admin)
    if (session.user.role === 'ADMIN') {
      const allInstitutes = await prisma.institute.findMany({
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
        select: instituteSelect,
      });

      return NextResponse.json({
        success: true,
        data: allInstitutes.map((inst: any) => ({
          ...inst,
          newLeads: (inst._count?.enquiries || 0) + (inst._count?.inboundLeads || 0),
          pendingMembers: inst._count?.memberships || 0,
          activeBatches: inst._count?.batches || 0,
        })),
      });
    }

    // For regular INSTITUTE_MANAGER users, get institutes they explicitly manage
    const managedInstitutes = await prisma.instituteManager.findMany({
      where: { userId: session.user.id },
      include: {
        institute: {
          select: instituteSelect,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: managedInstitutes.map((m: any) => ({
        ...m.institute,
        newLeads: (m.institute._count?.enquiries || 0) + (m.institute._count?.inboundLeads || 0),
        pendingMembers: m.institute._count?.memberships || 0,
        activeBatches: m.institute._count?.batches || 0,
      })),
    });
  } catch (error: any) {
    console.error('Manager GET API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
