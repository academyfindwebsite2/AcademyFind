import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { ensureInstituteChannels } from '@/lib/chat/ensureInstituteChannels';

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
      select: { id: true, name: true, subscriptionPlan: true }
    });
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const isLocked = institute.subscriptionPlan === 'BASIC' || institute.subscriptionPlan === 'VERIFIED';
    if (isLocked) {
      return NextResponse.json({
        success: true,
        data: {
          isLocked: true,
          plan: institute.subscriptionPlan,
          channels: [],
          reports: []
        }
      });
    }

    // Ensure default system channels exist (parity with web layout)
    await ensureInstituteChannels(instituteId);

    // Calculate dynamic member counts for display (parity with web chat page)
    const [activeStudents, activeTeachers, managers] = await Promise.all([
      prisma.studentInstituteRecord.count({
        where: { instituteId, isVerified: true, membership: { status: "ACTIVE" } },
      }),
      prisma.teacherInstituteRecord.count({
        where: { instituteId, isVerified: true, membership: { status: "ACTIVE" } },
      }),
      prisma.instituteManager.count({
        where: { instituteId },
      }),
    ]);

    const [channels, reports] = await Promise.all([
      prisma.conversation.findMany({
        where: { instituteId, type: "INSTITUTE" },
        orderBy: [{ channelType: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          channelType: true,
          isReadOnly: true,
          memberCount: true,
          createdAt: true,
          lastMessage: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              sender: { select: { name: true, username: true } },
            },
          },
        },
      }),
      prisma.messageReport.findMany({
        where: {
          message: { conversation: { instituteId } },
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          reason: true,
          status: true,
          createdAt: true,
          message: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              sender: { select: { name: true, username: true } },
              conversation: { select: { id: true, title: true, channelType: true } },
            },
          },
          reporter: { select: { name: true, username: true } },
        },
      }),
    ]);

    // Format member counts according to channel scope
    const totalCommunityMembers = activeStudents + activeTeachers + managers;
    const formattedChannels = channels.map((ch: any) => {
      let count = ch.memberCount;
      if (["GENERAL", "ANNOUNCEMENTS", "QNA", "STUDENTS"].includes(ch.channelType || "")) {
        count = totalCommunityMembers;
      } else if (ch.channelType === "TEACHERS") {
        count = activeTeachers + managers;
      } else if (ch.channelType === "STAFF") {
        count = managers;
      }
      return {
        ...ch,
        memberCount: Math.max(count || 0, 1),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        isLocked: false,
        plan: institute.subscriptionPlan,
        stats: {
          totalChannels: channels.length,
          customChannels: channels.filter((c: any) => c.channelType === 'CUSTOM').length,
          totalMembers: totalCommunityMembers,
          pendingReports: reports.length,
        },
        channels: formattedChannels,
        reports,
      }
    });
  } catch (error: any) {
    console.error("Manager Chat API Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { instituteId, title, isReadOnly } = body;

    if (!instituteId || !title?.trim()) {
      return NextResponse.json({ success: false, error: 'Institute ID and Channel Title are required' }, { status: 400 });
    }

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { subscriptionPlan: true }
    });
    if (institute?.subscriptionPlan === 'BASIC' || institute?.subscriptionPlan === 'VERIFIED') {
      return NextResponse.json({ success: false, error: 'Chat channels are locked on your subscription plan' }, { status: 403 });
    }

    const channel = await prisma.conversation.create({
      data: {
        instituteId,
        title: title.trim(),
        channelType: 'CUSTOM',
        isReadOnly: !!isReadOnly,
        type: 'INSTITUTE',
        createdById: session.user.id,
        participants: {
          create: {
            userId: session.user.id,
            role: 'MANAGER',
          }
        }
      },
      select: {
        id: true,
        title: true,
        channelType: true,
        isReadOnly: true,
        memberCount: true,
      }
    });

    return NextResponse.json({ success: true, data: channel });
  } catch (error: any) {
    console.error("Manager Chat POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { reportId, action } = body; // action: 'DISMISS' | 'DELETE'

    if (!reportId || !action) {
      return NextResponse.json({ success: false, error: 'Report ID and Action required' }, { status: 400 });
    }

    const report = await prisma.messageReport.findUnique({
      where: { id: reportId },
      include: {
        message: {
          include: { conversation: { select: { instituteId: true } } }
        }
      }
    });
    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    const instituteId = report.message?.conversation?.instituteId;
    if (instituteId) {
      const isManager = await prisma.instituteManager.findFirst({
        where: { userId: session.user.id, instituteId }
      });
      if (!isManager && session.user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    if (action === 'DELETE' && report.messageId) {
      await prisma.message.delete({ where: { id: report.messageId } });
    }

    await prisma.messageReport.update({
      where: { id: reportId },
      data: { status: action === 'DELETE' ? 'ACTION_TAKEN' : 'DISMISSED' }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Manager Chat PUT Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
    }

    const channel = await prisma.conversation.findUnique({
      where: { id: channelId }
    });

    if (!channel || channel.channelType !== 'CUSTOM') {
      return NextResponse.json({ success: false, error: 'Can only delete custom channels' }, { status: 400 });
    }

    if (!channel.instituteId) {
      return NextResponse.json({ success: false, error: 'Invalid channel' }, { status: 400 });
    }

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId: channel.instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await prisma.conversation.delete({ where: { id: channelId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Manager Chat DELETE Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
