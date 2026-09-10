"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteInstituteRequestAction(id: string) {
    try {
        await prisma.instituteRequest.delete({
            where: { id }
        });
        revalidatePath("/af-ass-manage/instituteRequests");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting institute request:", error);
        return { success: false, error: "Failed to delete institute request" };
    }
}

import { approveInstituteRequest } from "@/lib/User/admin/adminApprovalInstitute";

export async function updateInstituteRequestStatus(id: string, status: string, notes: string | null): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    publicListingUrl?: string;
    managerDashboardUrl?: string;
    managerName?: string;
    instituteName?: string;
    phone?: string | null;
    waMessage?: string;
}> {
    try {
        if (status === "APPROVED") {
            const approveRes = await approveInstituteRequest(id);
            if (!approveRes.success) {
                return approveRes;
            }
            if (notes !== null && notes !== undefined) {
                await prisma.instituteRequest.update({
                    where: { id },
                    data: { adminNotes: notes }
                });
            }
            revalidatePath("/af-ass-manage/instituteRequests");
            revalidatePath(`/af-ass-manage/instituteRequests/${id}`);
            return approveRes;
        }

        await prisma.instituteRequest.update({
            where: { id },
            data: { 
                status,
                adminNotes: notes
            }
        });
        revalidatePath("/af-ass-manage/instituteRequests");
        revalidatePath(`/af-ass-manage/instituteRequests/${id}`);
        return { success: true };
    } catch (error: any) {
        console.error("Error updating institute request:", error);
        return { success: false, error: "Failed to update institute request" };
    }
}
