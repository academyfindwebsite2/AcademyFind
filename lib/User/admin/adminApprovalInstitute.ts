"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncSingleInstituteToMeili } from '@/scripts/SyncInstitute';
import { meili } from "@/lib/meilisearch";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

import {
    buildInstituteRequestLinks,
    buildInstituteRequestWhatsAppMessage,
} from "@/lib/institutes/instituteRequestLinks";

export { buildInstituteRequestLinks, buildInstituteRequestWhatsAppMessage };

export async function sendInstituteRequestApprovalEmail(params: {
    toEmail: string;
    managerName: string;
    instituteName: string;
    publicListingUrl: string;
    managerDashboardUrl: string;
}) {
    try {
        await resend.emails.send({
            from: "AcademyFind <no-reply@academyfind.com>",
            to: params.toEmail,
            subject: "Your Institute Listing Request has been Approved! 🎉",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                    <div style="text-align: center; padding: 20px 0;">
                        <h1 style="color: #f59e0b; margin: 0;">AcademyFind</h1>
                    </div>
                    <h2 style="color: #1e293b;">Congratulations, ${params.managerName}!</h2>
                    <p>Your request to list <strong>${params.instituteName}</strong> on AcademyFind has been officially verified & <strong>APPROVED</strong> by our admin team.</p>
                    <p>Your institute profile is now officially live on AcademyFind and visible to students nationwide.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${params.managerDashboardUrl}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Go to Manager Dashboard</a>
                    </div>

                    <p style="text-align: center;">
                        <a href="${params.publicListingUrl}" style="color: #3b82f6; text-decoration: underline; font-weight: bold;">View your public profile page</a>
                    </p>

                    <div style="margin: 30px 0; padding: 20px; background-color: #fcf9f2; border-left: 4px solid #f59e0b; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #b45309; font-size: 16px;">What you can do in your Manager Dashboard:</h3>
                        <ul style="color: #78350f; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
                            <li>✅ Update institute info, courses, batches & fee structure</li>
                            <li>✅ Add facilities, faculty & gallery photos</li>
                            <li>✅ View student enquiry leads & admission callbacks</li>
                            <li>✅ Respond directly to student reviews</li>
                        </ul>
                    </div>
                    
                    <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; border-radius: 12px; text-align: center;">
                        <h3 style="margin-top: 0; color: #b45309; font-size: 18px;">Unlock Your Institute's Full Potential 🚀</h3>
                        <p style="color: #78350f; font-size: 14px; margin-bottom: 15px;">Want to get more student admissions? Upgrade your plan to get direct WhatsApp leads and top search ranking.</p>
                        <a href="${params.managerDashboardUrl}/billing" style="display: inline-block; background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">View Premium Plans</a>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px; margin-top: 30px;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
                    <p style="color: #64748b; font-size: 14px;">Best Regards,<br/><strong>The AcademyFind Team</strong></p>
                </div>
            `
        });
        console.log(`Institute Request approval email sent successfully to ${params.toEmail}`);
    } catch (emailError) {
        console.error("Failed to send institute request approval email:", emailError);
    }
}

export async function approveInstituteRequest(requestId: string) {
    try {
        const request = await prisma.instituteRequest.findUnique({
            where: { id: requestId },
            include: { institute: true, user: { select: { email: true, name: true, phone: true } } }
        });

        if (!request) return { success: false, error: "Request record not found." };
        if (request.status !== "PENDING") {
            return { success: false, error: `Request already ${request.status.toLowerCase()}.` };
        }

        const transactionOperations: any[] = [
            prisma.institute.update({
                where: { id: request.instituteId },
                data: {
                    isActive: true,
                    isPublished: true,
                    subscriptionPlan: "BASIC",
                    planWeight: 1
                }
            }),
            prisma.instituteRequest.update({
                where: { id: requestId },
                data: { status: "APPROVED" }
            }),
            prisma.user.update({
                where: { id: request.userId },
                data: {
                    canAddInstitute: true,
                    role: "INSTITUTE_MANAGER"
                }
            }),
            prisma.instituteManager.upsert({
                where: {
                    userId_instituteId: {
                        userId: request.userId,
                        instituteId: request.instituteId
                    }
                },
                update: {},
                create: {
                    userId: request.userId,
                    instituteId: request.instituteId
                }
            }),
            prisma.instituteMembership.upsert({
                where: {
                    userId_instituteId_role: {
                        userId: request.userId,
                        instituteId: request.instituteId,
                        role: 'MANAGER'
                    }
                },
                create: {
                    userId: request.userId,
                    instituteId: request.instituteId,
                    role: 'MANAGER',
                    status: 'ACTIVE',
                    joinedAt: new Date(),
                    isActive: true
                },
                update: {
                    status: 'ACTIVE',
                    joinedAt: new Date(),
                    isActive: true
                }
            })
        ];

        // DB Transaction execute
        await prisma.$transaction(transactionOperations);

        // Also ensure institute channels exist and add manager
        const { addMemberToInstituteChannels } = await import("@/lib/chat/ensureInstituteChannels");
        await addMemberToInstituteChannels(request.userId, request.instituteId, "MANAGER");

        console.log(`Institute ${request.instituteId} approved, Syncing to Meilisearch...`);

        const syncresult = await syncSingleInstituteToMeili(request.instituteId);
        if (!syncresult.success) {
            console.error("Database updated but MeiliSync Error:", syncresult.error);
        }

        revalidatePath("/af-ass-manage/instituteRequests");
        revalidatePath("/af-ass-manage");

        // 🔔 Notify Sales Manager & Admin if this institute is assigned
        try {
            const { notifySalesManagerOnInstituteClaim } = await import("@/lib/notifications/salesNotifications");
            await notifySalesManagerOnInstituteClaim({
                instituteId: request.instituteId,
                instituteName: request.institute.name,
                ownerName: request.user?.name || request.ownerName || undefined,
            });
        } catch (e) {
            console.error("Sales manager claim notification error:", e);
        }

        const { publicListingUrl, managerDashboardUrl } = buildInstituteRequestLinks(request.institute);
        const managerName = request.ownerName || request.user?.name || "Manager";
        const instituteName = request.institute.name;
        const targetEmail = request.user?.email || request.institute.email;
        const targetPhone = request.ownerPhone || request.user?.phone || request.institute.phone;

        // Send Email to the Manager
        if (targetEmail) {
            await sendInstituteRequestApprovalEmail({
                toEmail: targetEmail,
                managerName,
                instituteName,
                publicListingUrl,
                managerDashboardUrl,
            });
        }

        const waMessage = buildInstituteRequestWhatsAppMessage({
            managerName,
            instituteName,
            publicListingUrl,
            managerDashboardUrl,
        });

        return {
            success: true,
            message: "Institute Approved & Assigned to Manager (Basic Plan)!",
            publicListingUrl,
            managerDashboardUrl,
            managerName,
            instituteName,
            phone: targetPhone,
            waMessage,
        };
    } catch (error) {
        console.error("Approval action error:", error);
        return { success: false, error: "Approval pipeline failed." };
    }
}

export async function rejectInstituteRequest(requestId: string) {
    try {
        const request = await prisma.instituteRequest.findUnique({
            where: { id: requestId }
        });

        if (!request) return { success: false, error: "Request not found." };
        if (request.status !== "PENDING") {
            return { success: false, error: `Request already ${request.status.toLowerCase()}.` };
        }

        await prisma.$transaction([
            prisma.instituteRequest.update({
                where: { id: requestId },
                data: { status: "REJECTED" }
            }),
            prisma.user.update({
                where: { id: request.userId },
                data: { canAddInstitute: true }
            })
        ]);

        try {
            const index = meili.index("global_search");
            const documentId = `inst-${request.instituteId}`;
            // Background cleanup bina product blocking ke
            await index.deleteDocument(documentId);
            console.log(`🗑️ Sent remove request for unapproved institute ${documentId} to Meilisearch.`);
        } catch (meiliError) {
            console.error("Failed to delete rejected institute from Meilisearch:", meiliError);
        }

        revalidatePath("/af-ass-manage/instituteRequests");
        revalidatePath("/af-ass-manage");
        return { success: true, message: "Request rejected successfully." };
    } catch (error) {
        console.error("Rejection action error:", error);
        return { success: false, error: "Rejection pipeline failed." };
    }
}
