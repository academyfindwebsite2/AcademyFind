import { prisma } from "@/lib/prisma";
import { notifyAdmins, notifyUser } from "@/lib/notifications/notify";

export interface RecordUnlockParams {
  userId: string;
  instituteId: string;
  unlockType?: string;
  coinsSpent?: number;
  description?: string;
}

export function normalizeUnlockType(rawType?: string, description?: string): string {
  const text = (rawType || description || "").toLowerCase();
  if (text.includes("phone")) return "PHONE";
  if (text.includes("website") || text.includes("web")) return "WEBSITE";
  if (text.includes("email") || text.includes("mail")) return "EMAIL";
  if (text.includes("social")) return "SOCIAL";
  if (text.includes("community") || text.includes("feature")) return "COMMUNITY";
  return (rawType || "CONTACT").toUpperCase();
}

/**
 * Records an institute contact or feature unlock in the database
 * and triggers both Admin and Institute Manager notifications.
 */
export async function recordInstituteUnlock({
  userId,
  instituteId,
  unlockType,
  coinsSpent = 1,
  description,
}: RecordUnlockParams) {
  if (!userId || !instituteId) return null;

  try {
    const normalizedType = normalizeUnlockType(unlockType, description);

    const unlock = await prisma.instituteUnlock.create({
      data: {
        userId,
        instituteId,
        unlockType: normalizedType,
        coinsSpent: coinsSpent || 1,
        description,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        institute: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: {
              select: { name: true },
            },
          },
        },
      },
    });

    const studentName =
      unlock.user.name ||
      unlock.user.username ||
      unlock.user.email ||
      "A student";
    const studentContact = unlock.user.phone
      ? ` (Phone: ${unlock.user.phone})`
      : unlock.user.email
      ? ` (${unlock.user.email})`
      : "";

    const typeLabel =
      normalizedType.charAt(0).toUpperCase() +
      normalizedType.slice(1).toLowerCase();

    // 1. 🔔 Notify All Admins
    await notifyAdmins(
      "INSTITUTE_UNLOCK",
      `🔓 Contact Unlocked: ${unlock.institute.name}`,
      `${studentName}${studentContact} unlocked ${typeLabel} for ${unlock.institute.name}.`,
      "/af-ass-manage/unlocks",
      instituteId
    );

    // 2. 🔔 Notify All Institute Managers
    const managers = await prisma.instituteManager.findMany({
      where: { instituteId },
      select: { userId: true },
    });

    for (const manager of managers) {
      if (manager.userId === userId) continue;

      await notifyUser(
        manager.userId,
        "SYSTEM",
        `🔓 New Lead: ${typeLabel} Unlocked!`,
        `${studentName}${studentContact} just unlocked your institute's ${typeLabel} on AcademyFind! Check the Contact Unlocks tab in your manager portal.`,
        instituteId
      );
    }

    return unlock;
  } catch (error) {
    console.error("Failed to record institute unlock:", error);
    return null;
  }
}
