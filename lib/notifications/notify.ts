import type { NotificationType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAdminsPush, notifyUserPush } from "@/lib/pushNotifications";

export async function notifyUser(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  entityId?: string,
) {
  try {
    const notif = await prisma.userNotification.create({
      data: { userId, type, title, body, entityId },
    });

    if (body) {
      notifyUserPush({
        userId,
        title,
        body,
        data: { entityId, type },
      }).catch((err) => console.error("User push error:", err));
    }

    return notif;
  } catch (error) {
    console.error("Unable to create user notification", error);
    return null;
  }
}

export async function notifyAdmins(
  type: string,
  title: string,
  message: string,
  actionUrl?: string,
  referenceId?: string,
) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    if (admins.length === 0) return { count: 0 };

    const result = await prisma.adminNotification.createMany({
      data: admins.map(({ id }) => ({
        type,
        title,
        message,
        actionUrl,
        referenceId,
        userId: id,
      })),
    });

    // 🔔 Live Push Notification to all Admin devices
    notifyAdminsPush({
      title: title || '⚡ Admin Alert',
      body: message,
      data: { actionUrl, screen: '(admin)/sales' }
    }).catch(err => console.error("Admin Push Notification error:", err));

    return result;
  } catch (error) {
    console.error("Unable to notify admins", error);
    return null;
  }
}
