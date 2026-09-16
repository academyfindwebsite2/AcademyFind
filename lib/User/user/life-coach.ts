"use server"

import { prisma } from "@/lib/prisma";
import { sendLifeCoachSubmissionNotifications } from "@/lib/notifications/lifeCoachNotifications";

export async function submitLifeCoachRequest(formData: FormData) {
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string || "";
    const message = formData.get("message") as string;

    if (!fullName || !phone) {
        return { success: false, error: "Name, Phone, and Email are strictly required." };
    }

    try {
        await prisma.lifeCoachRequest.create({
            data: {
                fullName,
                phone,
                email,
                message: message || null
            }
        });
        await prisma.adminNotification.create({
            data: {
                type: "NEW_LIFE_COACH_REQUEST",
                title: "New Life Coach Request",
                message: `${fullName} (${phone}) requested a life coach.`,
            }
        });

        // 🚀 Automatically send personalized WhatsApp and Email confirmation to the applicant
        sendLifeCoachSubmissionNotifications({
            fullName,
            phone,
            email,
            message: message || null,
        }).catch((err) => {
            console.error("Failed to send life coach submission notifications:", err);
        });

        return { success: true, message: "Request logged inside admin queue!" };
    } catch (error) {
        console.error("Life Coach Submit Error:", error);
        return { success: false, error: "Failed to submit request due to pipeline error." };
    }
}