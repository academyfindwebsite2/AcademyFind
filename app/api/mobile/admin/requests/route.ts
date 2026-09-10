import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { approveInstituteRequest, rejectInstituteRequest } from '@/lib/User/admin/adminApprovalInstitute';
import { buildInstituteRequestLinks, buildInstituteRequestWhatsAppMessage } from '@/lib/institutes/instituteRequestLinks';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const requests = await prisma.instituteRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        institute: { select: { id: true, name: true, slug: true, email: true, phone: true, city: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true, phone: true } }
      },
      take: 50,
    });

    const enrichedRequests = requests.map(req => {
      const links = req.institute ? buildInstituteRequestLinks(req.institute) : null;
      const managerName = req.ownerName || req.user?.name || "Manager";
      const instituteName = req.institute?.name || "Institute";
      const waMessage = links ? buildInstituteRequestWhatsAppMessage({
        managerName,
        instituteName,
        publicListingUrl: links.publicListingUrl,
        managerDashboardUrl: links.managerDashboardUrl,
      }) : '';

      return {
        ...req,
        publicListingUrl: links?.publicListingUrl || null,
        managerDashboardUrl: links?.managerDashboardUrl || null,
        waMessage,
      };
    });

    return NextResponse.json({ success: true, data: enrichedRequests });
  } catch (error: any) {
    console.error("Mobile Admin Requests GET error:", error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Request ID and status are required' }, { status: 400 });
    }

    if (status === 'APPROVED') {
      const result = await approveInstituteRequest(id);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || 'Failed to approve request' }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: result.message || 'Institute request approved successfully',
        publicListingUrl: result.publicListingUrl,
        managerDashboardUrl: result.managerDashboardUrl,
        waMessage: result.waMessage,
        phone: result.phone,
      });
    }

    if (status === 'REJECTED') {
      const result = await rejectInstituteRequest(id);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || 'Failed to reject request' }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: result.message || 'Institute request rejected successfully',
      });
    }

    const updated = await prisma.instituteRequest.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Mobile Admin Requests PUT error:", error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
