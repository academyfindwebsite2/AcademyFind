import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { PLAN_LIMITS, PlanType } from '@/lib/plan_limits';

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
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get('source') || 'ALL';
    const statusParam = searchParams.get('status') || 'ALL';

    // Verify manager authorization
    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, name: true, subscriptionPlan: true },
    });
    if (!institute) {
      return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });
    }

    // Check Plan Gating (Parity with Website PLAN_LIMITS)
    const limits = PLAN_LIMITS[institute.subscriptionPlan as PlanType] || { hasLeads: false };
    if (!limits.hasLeads) {
      return NextResponse.json({
        success: true,
        data: {
          isLocked: true,
          plan: institute.subscriptionPlan,
          instituteName: institute.name,
          counts: {
            total: 0,
            direct: 0,
            meta: 0,
            google: 0,
            website: 0,
            zapier: 0,
          },
          leads: [],
        },
      });
    }

    // Fetch both direct portal enquiries and inbound ad leads (Parity with Website)
    const [
      directEnquiries,
      inboundLeads,
      directCount,
      metaCount,
      googleCount,
      websiteCount,
      zapierCount,
    ] = await Promise.all([
      prisma.instituteEnquiry.findMany({
        where: { instituteId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inboundLead.findMany({
        where: { instituteId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.instituteEnquiry.count({ where: { instituteId } }),
      prisma.inboundLead.count({ where: { instituteId, source: 'META_ADS' } }),
      prisma.inboundLead.count({ where: { instituteId, source: 'GOOGLE_ADS' } }),
      prisma.inboundLead.count({ where: { instituteId, source: 'WEBSITE_WEBHOOK' } }),
      prisma.inboundLead.count({ where: { instituteId, source: 'ZAPIER' } }),
    ]);

    // Format and unify leads list
    const combinedLeads = [
      ...directEnquiries.map((e: any) => ({
        id: e.id,
        name: e.name || 'Anonymous Student',
        phone: e.phone || '',
        email: e.email || '',
        message: e.message || '',
        status: e.status || 'NEW',
        source: e.source || 'ACADEMYFIND',
        isDirectPortal: true,
        isForwarded: !!(e.isForwarded || e.parentId),
        parentId: e.parentId,
        adminNote: e.adminNote || e.salesManagerNote || null,
        createdAt: e.createdAt,
      })),
      ...inboundLeads.map((l: any) => ({
        id: l.id,
        name: l.name || 'Ad Lead',
        phone: l.phone || '',
        email: l.email || '',
        message: l.message || '',
        status: l.status || 'NEW',
        source: l.source || 'INBOUND',
        isDirectPortal: false,
        isForwarded: false,
        parentId: null,
        adminNote: l.notes || null,
        createdAt: l.createdAt,
      })),
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply filtering by source and status
    const filteredLeads = combinedLeads.filter((item: any) => {
      let matchesSource = true;
      if (sourceParam !== 'ALL') {
        if (sourceParam === 'ACADEMYFIND') {
          matchesSource = item.isDirectPortal;
        } else {
          matchesSource = item.source === sourceParam;
        }
      }

      let matchesStatus = true;
      if (statusParam !== 'ALL') {
        matchesStatus = item.status === statusParam;
      }

      return matchesSource && matchesStatus;
    });

    const totalCount = directCount + metaCount + googleCount + websiteCount + zapierCount;

    return NextResponse.json({
      success: true,
      data: {
        isLocked: false,
        plan: institute.subscriptionPlan,
        instituteName: institute.name,
        counts: {
          total: totalCount,
          direct: directCount,
          meta: metaCount,
          google: googleCount,
          website: websiteCount,
          zapier: zapierCount,
        },
        leads: filteredLeads,
      },
    });
  } catch (error: any) {
    console.error('Manager Leads API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
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

    const body = await request.json();
    const { leadId, status, adminNote, isDirectPortal } = body;

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 });
    }

    // Try updating InboundLead if not direct portal
    if (isDirectPortal === false) {
      const inbound = await prisma.inboundLead.findUnique({ where: { id: leadId } });
      if (inbound && inbound.instituteId === instituteId) {
        const updated = await prisma.inboundLead.update({
          where: { id: leadId },
          data: {
            status: status || undefined,
            ...(adminNote !== undefined ? { notes: adminNote } : {}),
          },
        });
        return NextResponse.json({ success: true, data: updated });
      }
    }

    // Try updating InstituteEnquiry
    const enquiry = await prisma.instituteEnquiry.findUnique({ where: { id: leadId } });
    if (enquiry && enquiry.instituteId === instituteId) {
      const updated = await prisma.instituteEnquiry.update({
        where: { id: leadId },
        data: {
          status: status || undefined,
          ...(adminNote !== undefined ? { adminNote } : {}),
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // Fallback: check both if isDirectPortal was unspecified
    const inbound = await prisma.inboundLead.findUnique({ where: { id: leadId } });
    if (inbound && inbound.instituteId === instituteId) {
      const updated = await prisma.inboundLead.update({
        where: { id: leadId },
        data: {
          status: status || undefined,
          ...(adminNote !== undefined ? { notes: adminNote } : {}),
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: 'Lead not found or does not belong to this institute' }, { status: 404 });
  } catch (error: any) {
    console.error('Manager Leads PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
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

    const body = await request.json();
    const { name, phone, email, course, message } = body;

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ success: false, error: 'Student Name and Phone Number are required' }, { status: 400 });
    }

    const fullMessage = course?.trim()
      ? `Course: ${course.trim()}${message?.trim() ? `. ${message.trim()}` : ''}`
      : (message?.trim() || null);

    const lead = await prisma.instituteEnquiry.create({
      data: {
        instituteId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        message: fullMessage,
        status: 'NEW',
        source: 'MANUAL',
      },
    });

    return NextResponse.json({ success: true, message: 'Lead added successfully', data: lead });
  } catch (error: any) {
    console.error('Manager Leads POST Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to add lead' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { instituteId } = await params;
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 });
    }

    // Verify manager authorization
    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Try deleting from instituteEnquiry
    const enquiry = await prisma.instituteEnquiry.findUnique({ where: { id: leadId } });
    if (enquiry && enquiry.instituteId === instituteId) {
      await prisma.instituteEnquiry.delete({ where: { id: leadId } });
      return NextResponse.json({ success: true, message: 'Lead deleted' });
    }

    // Try deleting from inboundLead
    const inbound = await prisma.inboundLead.findUnique({ where: { id: leadId } });
    if (inbound && inbound.instituteId === instituteId) {
      await prisma.inboundLead.delete({ where: { id: leadId } });
      return NextResponse.json({ success: true, message: 'Lead deleted' });
    }

    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Manager Leads DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
