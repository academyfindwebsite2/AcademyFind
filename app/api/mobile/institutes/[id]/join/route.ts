import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { notifyUser } from '@/lib/notifications/notify';
import { notifyUserPush } from '@/lib/pushNotifications';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({
        success: true,
        data: {
          isLoggedIn: false,
          studentStatus: null,
          studentMembershipId: null,
          teacherStatus: null,
          teacherMembershipId: null,
        },
      });
    }

    const memberships = await prisma.instituteMembership.findMany({
      where: {
        userId: session.user.id,
        instituteId: id,
        status: { in: ['PENDING', 'ACTIVE', 'ALUMNI'] },
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    const student = memberships.find((m) => m.role === 'STUDENT');
    const teacher = memberships.find((m) => m.role === 'TEACHER');

    return NextResponse.json({
      success: true,
      data: {
        isLoggedIn: true,
        studentStatus: student ? student.status : null,
        studentMembershipId: student ? student.id : null,
        teacherStatus: teacher ? teacher.status : null,
        teacherMembershipId: teacher ? teacher.id : null,
      },
    });
  } catch (error: any) {
    console.error('Mobile Join GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please login first' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const role = (body.role || 'STUDENT').toUpperCase() as 'STUDENT' | 'TEACHER';

    // Check for existing membership request for this role
    const existing = await prisma.instituteMembership.findFirst({
      where: { userId, instituteId: id, role, status: { in: ['PENDING', 'ACTIVE', 'ALUMNI'] } },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `You already have an ${existing.status.toLowerCase()} request/membership as a ${role.toLowerCase()}.`,
      }, { status: 400 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id },
      select: { name: true, managers: { select: { userId: true } } },
    });

    if (!institute) {
      return NextResponse.json({ success: false, error: 'Institute not found.' }, { status: 404 });
    }

    const user = session.user;
    const applicantName = user?.name || 'A user';

    if (role === 'TEACHER') {
      const { designation, department, teachingSubjects, bio } = body;

      await prisma.$transaction(async (tx) => {
        const teacherProfile = await tx.teacherProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });

        const membership = await tx.instituteMembership.create({
          data: {
            userId,
            instituteId: id,
            role: 'TEACHER',
            status: 'PENDING',
          },
        });

        const subjectsArray = typeof teachingSubjects === 'string'
          ? teachingSubjects.split(',').map((s: string) => s.trim()).filter(Boolean)
          : (Array.isArray(teachingSubjects) ? teachingSubjects : []);

        await tx.teacherInstituteRecord.create({
          data: {
            membershipId: membership.id,
            teacherProfileId: teacherProfile.id,
            instituteId: id,
            designation: designation || null,
            department: department || null,
            teachingSubjects: subjectsArray,
            bio: bio || null,
          },
        });
      });
    } else {
      const { courseName, batchYear, passoutYear, bio } = body;

      await prisma.$transaction(async (tx) => {
        const studentProfile = await tx.studentProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });

        const membership = await tx.instituteMembership.create({
          data: {
            userId,
            instituteId: id,
            role: 'STUDENT',
            status: 'PENDING',
          },
        });

        await tx.studentInstituteRecord.create({
          data: {
            membershipId: membership.id,
            studentProfileId: studentProfile.id,
            instituteId: id,
            courseName: courseName || null,
            batchYear: batchYear ? Number(batchYear) : null,
            passoutYear: passoutYear ? Number(passoutYear) : null,
            bio: bio || null,
          },
        });
      });
    }

    // Notify institute managers
    const roleLabel = role === 'TEACHER' ? 'Faculty / Teacher' : 'Student';
    for (const mgr of institute.managers) {
      notifyUser(
        mgr.userId,
        'SYSTEM',
        `New ${roleLabel} Join Request`,
        `${applicantName} requested to join ${institute.name} as a ${role.toLowerCase()}.`,
        id
      ).catch(() => {});

      notifyUserPush({
        userId: mgr.userId,
        title: `New ${roleLabel} Join Request 📋`,
        body: `${applicantName} requested to join ${institute.name}.`,
        data: { route: `/(manager)/${id}/members` },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `Your request to join as a ${role.toLowerCase()} has been sent successfully.`,
    });
  } catch (error: any) {
    console.error('Mobile Join Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get('membershipId');

    const membership = await prisma.instituteMembership.findFirst({
      where: membershipId
        ? { id: membershipId, userId, instituteId: id }
        : { userId, instituteId: id, status: 'PENDING' },
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    if (membership.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Only pending requests can be cancelled' }, { status: 400 });
    }

    // Set to REJECTED or delete so user can re-apply if desired
    await prisma.instituteMembership.update({
      where: { id: membership.id },
      data: { status: 'REJECTED', isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Join request cancelled successfully.',
    });
  } catch (error: any) {
    console.error('Mobile Join DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
