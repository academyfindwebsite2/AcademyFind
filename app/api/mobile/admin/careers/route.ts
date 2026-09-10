import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const type = searchParams.get('type');

    if (type === 'talent-pool' || searchParams.get('talentPool') === 'true') {
      const resumes = await prisma.generalResume.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json({ success: true, data: resumes });
    }

    if (jobId) {
      const [job, applications] = await Promise.all([
        prisma.jobPosting.findUnique({
          where: { id: jobId },
          select: { id: true, title: true, department: true, location: true, type: true, isActive: true },
        }),
        prisma.jobApplication.findMany({
          where: { jobId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return NextResponse.json({ success: true, data: { job, applications } });
    }

    const [careers, talentPoolCount] = await Promise.all([
      prisma.jobPosting.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { applications: true } },
        },
        take: 50,
      }),
      prisma.generalResume.count(),
    ]);

    return NextResponse.json({ success: true, data: careers, talentPoolCount });
  } catch (error: any) {
    console.error('Careers API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, isActive } = await request.json();

    const updated = await prisma.jobPosting.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    if (type === 'talent-pool') {
      await prisma.generalResume.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Talent pool resume deleted' });
    }

    await prisma.jobPosting.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
