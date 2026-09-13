"use server";

import { prisma } from "@/lib/prisma";
import { notifyAdminsPush } from "@/lib/pushNotifications";

export async function requestGlobalCallback(formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const phone = formData.get("phone") as string;
        const sourceUrl = formData.get("sourceUrl") as string; 
        const userMessage = formData.get("message") as string;

        if (!name || !phone) {
            return { success: false, error: "Name and Phone are required." };
        }

        const messageParts = [];
        if (userMessage?.trim()) messageParts.push(userMessage.trim());
        messageParts.push(`Callback requested from page: ${sourceUrl}`);

        await prisma.lifeCoachRequest.create({
            data: {
                fullName: name,
                phone: phone,
                message: messageParts.join(" | "),
                status: "PENDING"
            }
        });

        const notifText = userMessage?.trim()
            ? `${name} (${phone}) requested a callback: "${userMessage.trim()}"`
            : `${name} (${phone}) requested a general callback.`;

        await prisma.adminNotification.create({
            data: {
                type: "NEW_CALLBACK_REQUEST",
                title: "New Callback Request",
                message: notifText,
                actionUrl: "/af-ass-manage/life-coach"
            }
        });

        notifyAdminsPush({
            title: "📞 New Callback Request!",
            body: notifText,
            data: { screen: '(admin)/life-coach' }
        });

        return { success: true };
    } catch (error) {
        console.error("Global Callback Error:", error);
        return { success: false, error: "Something went wrong. Please try again." };
    }
}