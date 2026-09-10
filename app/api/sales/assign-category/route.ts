import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();

        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const { salesManagerId, categoryId, deadline } = body;

        if (!salesManagerId || !categoryId) {
            return NextResponse.json(
                { error: "salesManagerId and categoryId are required" },
                { status: 400 }
            );
        }

        // Verify the user is a sales manager
        const manager = await prisma.user.findUnique({
            where: { id: salesManagerId },
            select: { id: true, role: true, email: true, name: true }
        });

        if (!manager || manager.role !== "SALES_MANAGER") {
            return NextResponse.json({ error: "User is not a Sales Manager" }, { status: 400 });
        }

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            select: { id: true, name: true }
        });

        if (!category) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        // Check if already assigned
        const existing = await prisma.salesCategoryAssignment.findFirst({
            where: {
                salesManagerId,
                categoryId
            }
        });

        if (existing) {
            return NextResponse.json({ error: "Category already assigned to this manager" }, { status: 409 });
        }

        const assignment = await prisma.salesCategoryAssignment.create({
            data: {
                salesManagerId,
                categoryId,
                deadline: deadline ? new Date(deadline) : null,
            },
            include: {
                category: { select: { name: true } }
            }
        });

        // 🔔 In-App Notification to Sales Manager
        const deadlineText = deadline ? new Date(deadline).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        try {
            await prisma.userNotification.create({
                data: {
                    userId: salesManagerId,
                    type: "SYSTEM",
                    title: "New Category Assignment 📁",
                    body: `You have been assigned category: "${category.name}"${deadlineText ? ` (Deadline: ${deadlineText})` : ""}.`,
                    entityId: assignment.id,
                }
            });
        } catch (notifErr) {
            console.error("Failed to create category notification:", notifErr);
        }

        // 📧 Send Email to Sales Manager
        if (manager.email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://academyfind.com";
            const portalUrl = `${appUrl}/sales_manager/${salesManagerId}`;

            const htmlEmail = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="background-color: #f59e0b; padding: 16px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: bold;">📁 New Category Assignment</h2>
                    </div>
                    <p style="color: #334155; font-size: 15px; margin-bottom: 12px;">Hello <strong>${manager.name || "Sales Manager"}</strong>,</p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">You have been assigned a new category segment to manage on <strong>AcademyFind</strong>:</p>
                    
                    <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 8px;">
                        <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 17px;">🏷️ Category: ${category.name}</h3>
                        <p style="margin: 0; color: #64748b; font-size: 13px;"><strong>Deadline:</strong> ${deadlineText || "No fixed deadline"}</p>
                    </div>

                    <p style="color: #475569; font-size: 14px; line-height: 1.5;">Please review institutes under this category and update your progress in your sales manager portal.</p>
                    
                    <div style="margin-top: 24px; text-align: center;">
                        <a href="${portalUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; font-weight: bold; font-size: 14px; border-radius: 10px; text-decoration: none; display: inline-block;">Open Sales Portal →</a>
                    </div>
                </div>
            `;

            sendEmail(
                manager.email,
                `📁 New Category Assignment: ${category.name}`,
                htmlEmail
            ).catch(e => console.error("Email send error:", e));
        }

        return NextResponse.json({ success: true, assignment });

    } catch (error) {
        console.error("Error assigning category:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
