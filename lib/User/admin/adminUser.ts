"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth/requireAuth"

export async function toggleUserListingPermission(userId: string, newStatus: boolean) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { canAddInstitute: newStatus }
        });
        
        revalidatePath("/af-ass-manage/users");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update permission" };
    }
}

// 1. Role Change Action
export async function updateUserRole(userId: string, newRole: "USER" | "SALES_MANAGER" | "INSTITUTE_MANAGER" | "INSTITUTE_SALES_MANAGER" | "ADMIN" ) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole }
        });
        revalidatePath("/af-ass-manage/users");
        return { success: true, message: `User role updated to ${newRole}!` };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to update role." };
    }
}

// 2. Status Toggle Action (Block / Unblock)
export async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { isActive: !currentStatus } // True hai toh False (Block)
        });
        revalidatePath("/af-ass-manage/users");
        return { success: true, message: `User account ${!currentStatus ? 'activated' : 'blocked'} successfully!` };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to update account status." };
    }
}

// 3. Admin to User Direct Message
export async function createAdminToUserDm(targetUserId: string) {
    try {
        const session = await requireAuth();
        if (session.user.role !== "ADMIN") return { success: false, error: "Unauthorized" };

        const initiatorId = session.user.id;
        const receiverId = targetUserId;
        if (initiatorId === receiverId) return { success: false, error: "Cannot message yourself" };

        const dmKey = [initiatorId, receiverId].sort().join("_");
        let conversation = await prisma.conversation.findUnique({
            where: { dmKey },
            include: { participants: true },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    type: "DIRECT",
                    dmKey,
                    participants: {
                        create: [{ userId: initiatorId }, { userId: receiverId }],
                    },
                },
                include: { participants: true },
            });
        } else {
            await prisma.conversationParticipant.updateMany({
                where: {
                    conversationId: conversation.id,
                    userId: { in: [initiatorId, receiverId] },
                },
                data: { status: "ACTIVE", isHidden: false, leftAt: null },
            });
        }

        return { success: true, conversationId: conversation.id };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error.message || "Failed to start conversation." };
    }
}