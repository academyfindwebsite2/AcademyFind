import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        // Database se bilkul fresh rules aur permissions nikaalo
        const freshUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                role: true,
                canAddInstitute: true,
                blogAuthorProfile: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true
                    }
                },
                wallet: {
                    select: { balance: true }
                },
                managedInstitutes: {
                    select: {
                        institute: {
                            select: { id: true, slug: true }
                        }
                    },
                    take: 1
                },
                ismAssignments: {
                    where: { isActive: true },
                    select: { instituteId: true },
                    take: 1
                },
                ismInvitesReceived: {
                    where: { status: "PENDING" },
                    select: {
                        id: true,
                        institute: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({ authenticated: true, ...freshUser });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}