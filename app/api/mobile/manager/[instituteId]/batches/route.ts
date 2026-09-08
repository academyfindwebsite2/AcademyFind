import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { ensureBatchConversation } from '@/lib/chat/ensureBatchConversation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { instituteId } = await params;

    // Verify manager access
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
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const plan = institute.subscriptionPlan || 'BASIC';
    const isLocked = plan === 'BASIC' || plan === 'VERIFIED';

    const batches = await prisma.instituteBatch.findMany({
      where: { instituteId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { studentMembers: true, teacherMembers: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        batches,
        instituteName: institute.name,
        plan,
        isLocked,
      },
    });
  } catch (error: any) {
    console.error('Manager Batches GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { instituteId } = await params;

    // Verify manager access
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
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const plan = institute.subscriptionPlan || 'BASIC';
    if (plan === 'BASIC' || plan === 'VERIFIED') {
      return NextResponse.json({
        success: false,
        error: 'Batch creation requires a Premium or Ultra plan.',
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      courseName,
      description,
      mode = 'OFFLINE',
      duration,
      timing,
      fee,
      originalFee,
      seatsTotal,
      seatsLeft,
      academicYear,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Batch name is required' }, { status: 400 });
    }

    const parsedFee = fee !== undefined && fee !== '' ? parseInt(fee, 10) : null;
    const parsedOriginalFee = originalFee !== undefined && originalFee !== '' ? parseInt(originalFee, 10) : null;
    const parsedSeatsTotal = seatsTotal !== undefined && seatsTotal !== '' ? parseInt(seatsTotal, 10) : null;
    const parsedSeatsLeft = seatsLeft !== undefined && seatsLeft !== ''
      ? parseInt(seatsLeft, 10)
      : parsedSeatsTotal;

    const batch = await prisma.instituteBatch.create({
      data: {
        instituteId,
        name: name.trim(),
        courseName: courseName?.trim() || null,
        description: description?.trim() || null,
        mode: (mode as any) || 'OFFLINE',
        duration: duration?.trim() || null,
        timing: timing?.trim() || null,
        fee: isNaN(parsedFee as number) ? null : parsedFee,
        originalFee: isNaN(parsedOriginalFee as number) ? null : parsedOriginalFee,
        seatsTotal: isNaN(parsedSeatsTotal as number) ? null : parsedSeatsTotal,
        seatsLeft: isNaN(parsedSeatsLeft as number) ? null : parsedSeatsLeft,
        academicYear: academicYear?.trim() || null,
        isActive: true,
      },
      include: {
        _count: {
          select: { studentMembers: true, teacherMembers: true },
        },
      },
    });

    // Automatically create a batch conversation channel
    ensureBatchConversation(instituteId, batch.id, batch.name).catch(e =>
      console.warn('Batch conversation creation warning:', e)
    );

    return NextResponse.json({ success: true, data: batch });
  } catch (error: any) {
    console.error('Manager Batches POST Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { instituteId } = await params;

    // Verify manager access
    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Batch ID is required' }, { status: 400 });
    }

    // Sanitize numeric fields if passed
    if (data.fee !== undefined) data.fee = data.fee ? parseInt(data.fee, 10) : null;
    if (data.originalFee !== undefined) data.originalFee = data.originalFee ? parseInt(data.originalFee, 10) : null;
    if (data.seatsTotal !== undefined) data.seatsTotal = data.seatsTotal ? parseInt(data.seatsTotal, 10) : null;
    if (data.seatsLeft !== undefined) data.seatsLeft = data.seatsLeft ? parseInt(data.seatsLeft, 10) : null;

    const batch = await prisma.instituteBatch.update({
      where: { id, instituteId },
      data,
      include: {
        _count: {
          select: { studentMembers: true, teacherMembers: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: batch });
  } catch (error: any) {
    console.error('Manager Batches PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { instituteId } = await params;

    // Verify manager access
    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    // Clean up batch conversation
    await prisma.conversation.deleteMany({
      where: { batchId: id, instituteId, type: 'BATCH' },
    });

    await prisma.instituteBatch.delete({ where: { id, instituteId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Manager Batches DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
