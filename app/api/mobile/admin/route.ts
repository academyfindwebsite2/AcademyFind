import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthorized');
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw new Error('Admin access required');
  return session;
}

// Dashboard stats
export async function GET() {
  try {
    await requireAdmin();

    const [
      totalInstitutes,
      activeInstitutes,
      totalUsers,
      totalLeads,
      totalReviews,
      pendingClaims,
      pendingInstituteRequests,
      pendingPayments,
      newEnquiries,
      pendingSalesRequests,
      inboundLeadCount,
      lifeCoachCount,
      pendingMemberships,
      pendingChatReports
    ] = await Promise.all([
      prisma.institute.count(),
      prisma.institute.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.instituteEnquiry.count({ where: { isForwarded: false } }),
      prisma.review.count(),
      prisma.instituteClaim.count({ where: { status: 'PENDING' } }),
      prisma.instituteRequest.count({ where: { status: 'PENDING' } }),
      prisma.subscriptionPayment.count({ where: { status: 'PENDING' } }),
      prisma.instituteEnquiry.count({ where: { status: 'NEW', isForwarded: false } }),
      prisma.salesAssignmentRequest.count({ where: { status: 'PENDING' } }),
      prisma.inboundLead.count({ where: { status: 'NEW' } }),
      prisma.lifeCoachRequest.count({ where: { status: 'PENDING' } }),
      prisma.instituteMembership.count({ where: { status: 'PENDING' } }),
      prisma.messageReport.count({ where: { status: 'PENDING' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalInstitutes,
          activeInstitutes,
          totalUsers,
          totalLeads,
          totalReviews,
          pendingClaims,
          pendingInstituteRequests,
          pendingPayments,
          newEnquiries,
          pendingSalesRequests,
          inboundLeadCount,
          lifeCoachCount,
          pendingMemberships,
          pendingChatReports
        },
      },
    });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Admin access required' ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
