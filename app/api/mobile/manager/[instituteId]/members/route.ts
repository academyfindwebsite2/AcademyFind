import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { handleMembershipApproval } from '@/lib/membership/handleApproval';
import { addMemberToInstituteChannels } from '@/lib/chat/ensureInstituteChannels';
import { notifyUser } from '@/lib/notifications/notify';
import { notifyUserPush } from '@/lib/pushNotifications';

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
      select: { id: true, name: true, slug: true, subscriptionPlan: true },
    });
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const plan = institute.subscriptionPlan || 'BASIC';
    const isLocked = plan === 'BASIC' || plan === 'VERIFIED';

    const members = await prisma.instituteMembership.findMany({
      where: { instituteId, status: { in: ['PENDING', 'ACTIVE', 'ALUMNI', 'REJECTED'] } },
      include: {
        user: { select: { id: true, name: true, username: true, email: true, image: true } },
        studentRecord: { select: { id: true, courseName: true, batchYear: true, passoutYear: true, isVerified: true, bio: true } },
        teacherRecord: { select: { id: true, designation: true, department: true, teachingSubjects: true, isVerified: true, isFeatured: true, bio: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        members,
        instituteName: institute.name,
        plan,
        isLocked,
      },
    });
  } catch (error: any) {
    console.error('Manager Members GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
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
    const { membershipId, action, reason } = body; // action: 'approve' | 'reject'

    if (!membershipId || !action) {
      return NextResponse.json({ success: false, error: 'Missing membershipId or action' }, { status: 400 });
    }

    const membership = await prisma.instituteMembership.findUnique({
      where: { id: membershipId },
      include: {
        institute: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!membership || membership.instituteId !== instituteId) {
      return NextResponse.json({ success: false, error: 'Membership not found for this institute' }, { status: 404 });
    }

    if (action === 'approve') {
      await handleMembershipApproval(membershipId, session.user.id);

      notifyUserPush({
        userId: membership.userId,
        title: 'Membership Approved! 🎉',
        body: `You are now a verified member of ${membership.institute.name}.`,
        data: { route: `/institute/${instituteId}` },
      }).catch(e => console.warn('Push error:', e));

      return NextResponse.json({
        success: true,
        message: 'Member approved successfully!',
        action: 'approve',
      });
    }

    if (action === 'reject') {
      await prisma.instituteMembership.update({
        where: { id: membershipId },
        data: { status: 'REJECTED', isActive: false },
      });

      await notifyUser(
        membership.userId,
        'SYSTEM',
        'Membership request declined',
        reason
          ? `Your request for ${membership.institute.name} was declined: ${reason}`
          : `Your request for ${membership.institute.name} was declined.`,
        instituteId,
      );

      notifyUserPush({
        userId: membership.userId,
        title: 'Membership Request Declined',
        body: reason || `Your request for ${membership.institute.name} was declined.`,
      }).catch(e => console.warn('Push error:', e));

      return NextResponse.json({
        success: true,
        message: 'Membership request rejected.',
        action: 'reject',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Manager Members PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
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

    const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const body = await request.json();
    const { email, role = 'STUDENT', courseName = 'General', designation = 'Faculty' } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'User email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'No user found with this email on AcademyFind. They must register first.' }, { status: 404 });
    }

    // Check if already member
    const existing = await prisma.instituteMembership.findFirst({
      where: { userId: user.id, instituteId, role: role as any },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: `This user already has a ${role.toLowerCase()} membership record.` }, { status: 400 });
    }

    // Ensure student/teacher profile
    let profileId = '';
    if (role === 'STUDENT') {
      const profile = await prisma.studentProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      profileId = profile.id;
    } else if (role === 'TEACHER') {
      const profile = await prisma.teacherProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      profileId = profile.id;
    }

    // Create membership, records, and notify in transaction
    const newMembership = await prisma.$transaction(async (tx) => {
      const membership = await tx.instituteMembership.create({
        data: {
          instituteId,
          userId: user.id,
          role: role as any,
          status: 'ACTIVE',
          isActive: true,
          joinedAt: new Date(),
        },
      });

      if (role === 'STUDENT') {
        await tx.studentInstituteRecord.create({
          data: {
            studentProfileId: profileId,
            instituteId,
            membershipId: membership.id,
            courseName,
            isVerified: true,
          },
        });
      } else if (role === 'TEACHER') {
        await tx.teacherInstituteRecord.create({
          data: {
            teacherProfileId: profileId,
            instituteId,
            membershipId: membership.id,
            designation,
            teachingSubjects: [],
            isVerified: true,
          },
        });
      }

      await tx.userNotification.create({
        data: {
          userId: user.id,
          entityId: membership.id,
          type: 'SYSTEM',
          title: 'Added to Institute',
          body: `You have been added as a ${role.toLowerCase()} in ${institute.name}.`,
          isRead: false,
        },
      });

      return membership;
    });

    // Add member to chat channels
    addMemberToInstituteChannels(user.id, instituteId, role as any).catch(e => console.warn('Chat channels error:', e));

    notifyUserPush({
      userId: user.id,
      title: 'Added to Institute 🎉',
      body: `You have been added as a ${role.toLowerCase()} to ${institute.name}.`,
      data: { route: `/institute/${instituteId}` },
    }).catch(e => console.warn('Push error:', e));

    const fullMembership = await prisma.instituteMembership.findUnique({
      where: { id: newMembership.id },
      include: {
        user: { select: { id: true, name: true, username: true, email: true, image: true } },
        studentRecord: { select: { id: true, courseName: true, batchYear: true, passoutYear: true, isVerified: true, bio: true } },
        teacherRecord: { select: { id: true, designation: true, department: true, teachingSubjects: true, isVerified: true, isFeatured: true, bio: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Member added successfully!',
      data: fullMembership,
    });
  } catch (error: any) {
    console.error('Manager Members POST Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to add member' }, { status: 500 });
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
    const membershipId = searchParams.get('id');

    if (!membershipId) {
      return NextResponse.json({ success: false, error: 'Membership ID required' }, { status: 400 });
    }

    const membership = await prisma.instituteMembership.findUnique({
      where: { id: membershipId },
      include: { institute: { select: { name: true } } },
    });

    if (!membership || membership.instituteId !== instituteId) {
      return NextResponse.json({ success: false, error: 'Membership not found for this institute' }, { status: 404 });
    }

    // Soft delete status: 'REMOVED', isActive: false (parity with website)
    await prisma.instituteMembership.update({
      where: { id: membershipId },
      data: { status: 'REMOVED', isActive: false },
    });

    await notifyUser(
      membership.userId,
      'SYSTEM',
      'Membership removed',
      `You have been removed from ${membership.institute.name}.`,
      instituteId,
    );

    notifyUserPush({
      userId: membership.userId,
      title: 'Membership Removed',
      body: `You are no longer a member of ${membership.institute.name}.`,
    }).catch(e => console.warn('Push error:', e));

    return NextResponse.json({ success: true, message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('Manager Members DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to remove member' }, { status: 500 });
  }
}