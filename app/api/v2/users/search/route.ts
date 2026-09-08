import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const q = searchParams.get("q")?.trim();
        const instituteId = searchParams.get("instituteId");

        if (!q) {
            return NextResponse.json({ users: [] });
        }

        const users = await prisma.user.findMany({
            where: {
                id: { not: session.user.id },
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { username: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q, mode: "insensitive" } }
                ]
            },
            take: 20,
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                phone: true,
                image: true,
                role: true,
            }
        });

        if (!instituteId) {
            return NextResponse.json({ users });
        }

        // Add member / invite status via a SINGLE batch query (no N+1 sequential DB roundtrips)
        const userIds = users.map((u: any) => u.id);
        const memberships = userIds.length > 0
            ? await prisma.instituteMembership.findMany({
                where: {
                    instituteId,
                    userId: { in: userIds }
                },
                select: { userId: true, status: true }
            })
            : [];

        const membershipMap = new Map(memberships.map((m: any) => [m.userId, m.status]));

        const enrichedUsers = users.map((u: any) => {
            const status = membershipMap.get(u.id);
            return {
                ...u,
                isMember: status === "ACTIVE",
                isInvited: status === "PENDING"
            };
        });

        return NextResponse.json({ users: enrichedUsers });
    } catch (error) {
        console.error("Search users error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
