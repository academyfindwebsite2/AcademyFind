import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { NextRequest, NextResponse } from "next/server";
import { sendExpoPushNotification } from "@/lib/pushNotifications";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();

        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const { salesManagerId, instituteId, deadline } = body;

        if (!salesManagerId || !instituteId) {
            return NextResponse.json(
                { error: "salesManagerId and instituteId are required" },
                { status: 400 }
            );
        }

        const manager = await prisma.user.findUnique({
            where: { id: salesManagerId },
            select: { id: true, role: true, email: true, name: true, pushToken: true }
        });

        if (!manager || manager.role !== "SALES_MANAGER") {
            return NextResponse.json({ error: "User is not a Sales Manager" }, { status: 400 });
        }

        const cleanInstituteId = instituteId.startsWith("inst-") 
        ? instituteId.replace("inst-", "") 
        : instituteId;

        // Verify institute exists
        const institute = await prisma.institute.findUnique({
            where: { id: cleanInstituteId },
            select: { id: true, name: true }
        });

        if (!institute) {
            return NextResponse.json({ error: "Institute not found" }, { status: 404 });
        }

        // 🚀 SMART FIX: Upsert (Update if exists, Create if not)
        const assignment = await prisma.salesAssignment.upsert({
            where: { 
                instituteId: cleanInstituteId // Find by strictly instituteId
            },
            update: {
                salesManagerId: salesManagerId, // Transfer to new manager
                deadline: deadline ? new Date(deadline) : null,
            },
            create: {
                salesManagerId,
                instituteId : cleanInstituteId,
                deadline: deadline ? new Date(deadline) : null,
            },
            include: {
                institute: { select: { name: true } },
                salesManager: { select: { email: true, name: true } }
            }
        });

        // 🔔 1. In-App Notification to Sales Manager
        const deadlineText = deadline ? new Date(deadline).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        try {
            await prisma.userNotification.create({
                data: {
                    userId: salesManagerId,
                    type: "SYSTEM",
                    title: "New Institute Assignment 📋",
                    body: `You have been assigned institute: "${assignment.institute.name}"${deadlineText ? ` (Deadline: ${deadlineText})` : ""}.`,
                    entityId: assignment.id,
                }
            });
        } catch (notifErr) {
            console.error("Failed to create sales manager in-app notification:", notifErr);
        }

        // 📱 Send Push Notification to Sales Manager
        if (manager.pushToken) {
            sendExpoPushNotification({
                pushToken: manager.pushToken,
                title: "📋 New Institute Assignment",
                body: `You have been assigned to manage ${assignment.institute.name}${deadlineText ? ` (Deadline: ${deadlineText})` : ""}.`,
                data: { screen: '(manager)', assignmentId: assignment.id }
            }).catch(e => console.error("Sales push error:", e));
        }

        // 📧 2. Send Email to Sales Manager
        if (manager.email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://academyfind.com";
            const portalUrl = `${appUrl}/sales_manager/${salesManagerId}`;

            const htmlEmail = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="background-color: #f59e0b; padding: 16px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: bold;">📋 New Institute Assignment</h2>
                    </div>
                    <p style="color: #334155; font-size: 15px; margin-bottom: 12px;">Hello <strong>${manager.name || "Sales Manager"}</strong>,</p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">You have been assigned a new institute to manage and onboard on <strong>AcademyFind</strong>:</p>
                    
                    <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 8px;">
                        <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 17px;">🏫 ${assignment.institute.name}</h3>
                        <p style="margin: 0; color: #64748b; font-size: 13px;"><strong>Deadline:</strong> ${deadlineText || "No fixed deadline"}</p>
                    </div>

                    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Please contact the institute management, update your progress, and report status back in your sales manager portal.</p>
                    
                    <div style="margin-top: 24px; text-align: center;">
                        <a href="${portalUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; font-weight: bold; font-size: 14px; border-radius: 10px; text-decoration: none; display: inline-block;">Open Sales Portal →</a>
                    </div>
                </div>
            `;

            sendEmail(
                manager.email,
                `📋 New Assignment: ${assignment.institute.name}`,
                htmlEmail
            ).catch(e => console.error("Email send error:", e));
        }

        return NextResponse.json({ success: true, assignment });

    } catch (error) {
        console.error("Error assigning institute:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}   