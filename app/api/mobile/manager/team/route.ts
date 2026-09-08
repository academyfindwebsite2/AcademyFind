import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { notifyUserPush } from '@/lib/pushNotifications';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const instituteId = searchParams.get('instituteId');
    if (!instituteId) return NextResponse.json({ success: false, error: 'Institute ID missing' }, { status: 400 });

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      include: { 
        managers: { 
          include: { 
            user: { 
              select: { id: true, name: true, email: true, image: true, createdAt: true } 
            } 
          },
          orderBy: { createdAt: 'asc' }
        } 
      }
    });

    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const plan = institute.subscriptionPlan || "BASIC"; 
    let maxMembers = 1;
    if (plan === "PREMIUM") maxMembers = 3;
    if (plan === "ULTRA") maxMembers = 5;

    const currentMembers = institute.managers.length;
    const canAddMember = currentMembers < maxMembers;

    return NextResponse.json({ 
      success: true, 
      data: { 
        team: institute.managers,
        plan,
        maxMembers,
        currentMembers,
        canAddMember,
        currentUserId: session.user.id,
        instituteName: institute.name
      } 
    });
  } catch (error: any) {
    console.error("Manager Team API Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { instituteId, email } = body;

    if (!instituteId || !email) {
      return NextResponse.json({ success: false, error: 'Institute ID and Email are required' }, { status: 400 });
    }

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      include: { managers: true }
    });
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const plan = institute.subscriptionPlan || "BASIC"; 
    let maxAllowed = 1;
    if (plan === "PREMIUM") maxAllowed = 3;
    if (plan === "ULTRA") maxAllowed = 5;

    if (institute.managers.length >= maxAllowed) {
      return NextResponse.json({ 
        success: false, 
        error: `Your ${plan} plan only allows up to ${maxAllowed} team member${maxAllowed > 1 ? 's' : ''}. Upgrade your plan to add more.` 
      }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userToAdd = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (!userToAdd) {
      return NextResponse.json({ success: false, error: 'No user found with this email on AcademyFind. They must register first.' }, { status: 404 });
    }

    const alreadyManager = institute.managers.find(m => m.userId === userToAdd.id);
    if (alreadyManager) {
      return NextResponse.json({ success: false, error: 'This user is already a team member of this institute.' }, { status: 400 });
    }

    // Atomic transaction to add manager, set role, add membership, and send notification
    await prisma.$transaction([
      prisma.instituteManager.create({
        data: { instituteId, userId: userToAdd.id }
      }),
      prisma.user.update({
        where: { id: userToAdd.id },
        data: { role: "INSTITUTE_MANAGER" }
      }),
      prisma.instituteMembership.upsert({
        where: { userId_instituteId_role: { userId: userToAdd.id, instituteId, role: 'MANAGER' } },
        create: {
          userId: userToAdd.id,
          instituteId,
          role: 'MANAGER',
          status: 'ACTIVE',
          joinedAt: new Date(),
          isActive: true
        },
        update: {
          role: 'MANAGER',
          status: 'ACTIVE',
          isActive: true
        }
      }),
      prisma.userNotification.create({
        data: {
          userId: userToAdd.id,
          entityId: instituteId,
          type: "SYSTEM",
          title: "Added as Team Member",
          body: `You have been added as a co-manager to ${institute.name}.`,
          isRead: false
        }
      })
    ]);

    // Send push notification asynchronously
    notifyUserPush({
      userId: userToAdd.id,
      title: "Added as Team Member 🎉",
      body: `You are now a co-manager for ${institute.name}.`,
      data: { route: `/(manager)/${instituteId}` }
    }).catch(e => console.warn("Push notification error:", e));

    const updatedTeam = await prisma.instituteManager.findMany({
      where: { instituteId },
      include: { 
        user: { 
          select: { id: true, name: true, email: true, image: true, createdAt: true } 
        } 
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Team member added successfully!',
      data: { 
        team: updatedTeam, 
        currentMembers: updatedTeam.length, 
        maxMembers: maxAllowed, 
        canAddMember: updatedTeam.length < maxAllowed,
        plan,
        currentUserId: session.user.id,
        instituteName: institute.name
      } 
    });

  } catch (error: any) {
    console.error("Manager Team POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const instituteId = searchParams.get('instituteId');
    const userId = searchParams.get('userId');

    if (!instituteId || !userId) {
      return NextResponse.json({ success: false, error: 'Institute ID and User ID missing' }, { status: 400 });
    }

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { name: true, subscriptionPlan: true }
    });
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    // Protect against removing the only manager of the institute
    const totalManagers = await prisma.instituteManager.count({ where: { instituteId } });
    if (totalManagers <= 1) {
      return NextResponse.json({ success: false, error: 'Cannot remove the only manager of this institute.' }, { status: 400 });
    }

    // Delete manager record and institute membership
    await prisma.$transaction([
      prisma.instituteManager.deleteMany({
        where: { instituteId, userId }
      }),
      prisma.instituteMembership.deleteMany({
        where: { instituteId, userId, role: 'MANAGER' }
      }),
      prisma.userNotification.create({
        data: {
          userId,
          entityId: instituteId,
          type: "SYSTEM",
          title: "Team Access Revoked",
          body: `You are no longer a co-manager for ${institute.name}.`,
          isRead: false
        }
      })
    ]);

    // If user has no other managed institutes and is not admin, revert role to USER
    const remainingInstitutes = await prisma.instituteManager.count({ where: { userId } });
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (remainingInstitutes === 0 && userRecord?.role === 'INSTITUTE_MANAGER') {
      await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
    }

    // Push notification to the removed member
    notifyUserPush({
      userId,
      title: "Team Access Revoked",
      body: `Your manager privileges for ${institute.name} have been revoked.`,
    }).catch(e => console.warn("Push error:", e));

    const plan = institute.subscriptionPlan || "BASIC"; 
    let maxMembers = 1;
    if (plan === "PREMIUM") maxMembers = 3;
    if (plan === "ULTRA") maxMembers = 5;

    const updatedTeam = await prisma.instituteManager.findMany({
      where: { instituteId },
      include: { 
        user: { 
          select: { id: true, name: true, email: true, image: true, createdAt: true } 
        } 
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Member removed successfully.',
      data: {
        team: updatedTeam,
        currentMembers: updatedTeam.length,
        maxMembers,
        canAddMember: updatedTeam.length < maxMembers,
        plan,
        currentUserId: session.user.id,
        instituteName: institute.name
      }
    });

  } catch (error: any) {
    console.error("Manager Team DELETE Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
