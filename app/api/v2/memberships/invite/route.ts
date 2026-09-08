import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { notifyUserPush } from "@/lib/pushNotifications";

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { userId, instituteId, role } = body;

        if (!userId || !instituteId || !role) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Validate manager
        const managerCheck = await prisma.instituteManager.findUnique({
            where: {
                userId_instituteId: { userId: session.user.id, instituteId }
            }
        });
        if (!managerCheck && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized to invite" }, { status: 403 });
        }

        // Check if already member
        const existing = await prisma.instituteMembership.findFirst({
            where: { userId, instituteId }
        });

        if (existing) {
            return NextResponse.json({ error: "User is already a member or has a pending request" }, { status: 400 });
        }

        const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
        if (!institute) return NextResponse.json({ error: "Institute not found" }, { status: 404 });

        // Ensure profile exists based on role
        let profileId = "";
        if (role === "STUDENT") {
            const profile = await prisma.studentProfile.upsert({
                where: { userId },
                create: { userId },
                update: {},
            });
            profileId = profile.id;
        } else if (role === "TEACHER") {
            const profile = await prisma.teacherProfile.upsert({
                where: { userId },
                create: { userId },
                update: {},
            });
            profileId = profile.id;
        }

        // Create membership
        await prisma.$transaction(async (tx) => {
            const membership = await tx.instituteMembership.create({
                data: {
                    userId,
                    instituteId,
                    role: role as any,
                    status: "PENDING",
                    isActive: false,
                }
            });

            if (role === "STUDENT") {
                await tx.studentInstituteRecord.create({
                    data: {
                        studentProfileId: profileId,
                        instituteId,
                        membershipId: membership.id,
                        courseName: "General",
                        isVerified: false,
                    }
                });
            } else if (role === "TEACHER") {
                await tx.teacherInstituteRecord.create({
                    data: {
                        teacherProfileId: profileId,
                        instituteId,
                        membershipId: membership.id,
                        designation: "Faculty",
                        teachingSubjects: [],
                        isVerified: false,
                    }
                });
            }

            // Create Notification
            await tx.userNotification.create({
                data: {
                    userId,
                    type: "NOTICE",
                    title: "Institute Invitation",
                    body: JSON.stringify({
                        message: `${institute.name} has invited you to join as a ${role.toLowerCase()}.`,
                        invite: true,
                        instituteId,
                        role
                    }),
                    entityId: membership.id
                }
            });
        });

        notifyUserPush({
            userId,
            title: `Invitation from ${institute.name} ✉️`,
            body: `You have been invited to join ${institute.name} as a ${role.toLowerCase()}.`,
            data: { route: `/institute/${instituteId}` },
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Invite error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
