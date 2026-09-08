import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { instituteId } = await params;
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId required' }, { status: 400 });
    }

    const batch = await prisma.instituteBatch.findFirst({
      where: { id: batchId, instituteId },
      include: {
        studentMembers: {
          include: {
            studentRecord: {
              include: {
                studentProfile: { include: { user: true } },
                membership: { include: { user: true } },
              },
            },
          },
        },
        teacherMembers: {
          include: {
            teacherRecord: {
              include: {
                teacherProfile: { include: { user: true } },
                membership: { include: { user: true } },
              },
            },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }

    // Get active students and teachers from the institute to invite
    const [activeStudents, activeTeachers] = await Promise.all([
      prisma.studentInstituteRecord.findMany({
        where: { instituteId, membership: { status: "ACTIVE" } },
        include: {
          studentProfile: { include: { user: true } },
          membership: { include: { user: true } },
        },
      }),
      prisma.teacherInstituteRecord.findMany({
        where: { instituteId, membership: { status: "ACTIVE" } },
        include: {
          teacherProfile: { include: { user: true } },
          membership: { include: { user: true } },
        },
      }),
    ]);

    const enrolledStudentIds = new Set(batch.studentMembers.map((s: any) => s.studentRecordId));
    const enrolledTeacherIds = new Set(batch.teacherMembers.map((t: any) => t.teacherRecordId));

    const availableStudents = activeStudents.filter((s: any) => !enrolledStudentIds.has(s.id));
    const availableTeachers = activeTeachers.filter((t: any) => !enrolledTeacherIds.has(t.id));

    return NextResponse.json({
      success: true,
      data: {
        studentMembers: batch.studentMembers,
        teacherMembers: batch.teacherMembers,
        availableStudents,
        availableTeachers,
      },
    });
  } catch (error: any) {
    console.error('Batch members GET error:', error);
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
    const body = await request.json();
    const { batchId, type, recordId } = body;

    if (!batchId || !type || !recordId) {
      return NextResponse.json({ success: false, error: 'batchId, type (STUDENT|TEACHER), and recordId are required' }, { status: 400 });
    }

    const batch = await prisma.instituteBatch.findFirst({ where: { id: batchId, instituteId } });
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }

    if (type === 'STUDENT') {
      await prisma.batchStudent.create({
        data: { batchId, studentRecordId: recordId }
      });

      const studentRecord = await prisma.studentInstituteRecord.findUnique({
        where: { id: recordId },
        include: { studentProfile: true }
      });

      if (studentRecord?.studentProfile?.userId) {
        try {
          const { ensureBatchConversation } = await import("@/lib/chat/ensureBatchConversation");
          const conv = await ensureBatchConversation(instituteId, batchId, batch.name);
          await prisma.conversationParticipant.upsert({
            where: { conversationId_userId: { conversationId: conv.id, userId: studentRecord.studentProfile.userId } },
            create: { conversationId: conv.id, userId: studentRecord.studentProfile.userId, role: "MEMBER" },
            update: { status: "ACTIVE", leftAt: null, isHidden: false },
          });
        } catch (e) {
          console.error("Batch conversation sync error:", e);
        }
      }
    } else if (type === 'TEACHER') {
      await prisma.batchTeacher.create({
        data: { batchId, teacherRecordId: recordId }
      });

      const teacherRecord = await prisma.teacherInstituteRecord.findUnique({
        where: { id: recordId },
        include: { teacherProfile: true }
      });

      if (teacherRecord?.teacherProfile?.userId) {
        try {
          const { ensureBatchConversation } = await import("@/lib/chat/ensureBatchConversation");
          const conv = await ensureBatchConversation(instituteId, batchId, batch.name);
          await prisma.conversationParticipant.upsert({
            where: { conversationId_userId: { conversationId: conv.id, userId: teacherRecord.teacherProfile.userId } },
            create: { conversationId: conv.id, userId: teacherRecord.teacherProfile.userId, role: "ADMIN" },
            update: { status: "ACTIVE", leftAt: null, isHidden: false },
          });
        } catch (e) {
          console.error("Batch conversation sync error:", e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Batch member POST error:', error);
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

    const { searchParams } = new URL(request.url);
    const batchStudentId = searchParams.get('batchStudentId');
    const batchTeacherId = searchParams.get('batchTeacherId');

    if (batchStudentId) {
      const batchStudent = await prisma.batchStudent.findUnique({
        where: { id: batchStudentId },
        include: { studentRecord: { include: { studentProfile: true } } }
      });

      await prisma.batchStudent.delete({ where: { id: batchStudentId } });

      if (batchStudent?.batchId && batchStudent.studentRecord?.studentProfile?.userId) {
        const conv = await prisma.conversation.findFirst({ where: { batchId: batchStudent.batchId, type: "BATCH" } });
        if (conv) {
          await prisma.conversationParticipant.deleteMany({
            where: { conversationId: conv.id, userId: batchStudent.studentRecord.studentProfile.userId }
          });
        }
      }
    } else if (batchTeacherId) {
      const batchTeacher = await prisma.batchTeacher.findUnique({
        where: { id: batchTeacherId },
        include: { teacherRecord: { include: { teacherProfile: true } } }
      });

      await prisma.batchTeacher.delete({ where: { id: batchTeacherId } });

      if (batchTeacher?.batchId && batchTeacher.teacherRecord?.teacherProfile?.userId) {
        const conv = await prisma.conversation.findFirst({ where: { batchId: batchTeacher.batchId, type: "BATCH" } });
        if (conv) {
          await prisma.conversationParticipant.deleteMany({
            where: { conversationId: conv.id, userId: batchTeacher.teacherRecord.teacherProfile.userId }
          });
        }
      }
    } else {
      return NextResponse.json({ success: false, error: 'batchStudentId or batchTeacherId required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Batch member DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove member' }, { status: 500 });
  }
}
