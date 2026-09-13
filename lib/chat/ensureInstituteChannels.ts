import type {
  ChannelType,
  ConversationVisibility,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const INSTITUTE_CHANNELS: Array<{
  channelType: ChannelType;
  title: string;
  isReadOnly: boolean;
  visibility: ConversationVisibility;
}> = [
    {
      channelType: "GENERAL",
      title: "# General",
      isReadOnly: false,
      visibility: "INSTITUTE",
    },
    {
      channelType: "ANNOUNCEMENTS",
      title: "# Announcements",
      isReadOnly: true,
      visibility: "INSTITUTE",
    },
    {
      channelType: "STUDENTS",
      title: "# Q&A",
      isReadOnly: false,
      visibility: "INSTITUTE",
    },
    {
      channelType: "TEACHERS",
      title: "# Teachers",
      isReadOnly: false,
      visibility: "INSTITUTE",
    },
  ];

export async function ensureInstituteChannels(instituteId: string) {
  return Promise.all(
    INSTITUTE_CHANNELS.map((channel: any) =>
      prisma.conversation.upsert({
        where: {
          instituteId_channelType: {
            instituteId,
            channelType: channel.channelType,
          },
        },
        create: {
          type: "INSTITUTE",
          instituteId,
          ...channel,
        },
        update: {
          title: channel.title,
          isReadOnly: channel.isReadOnly,
          visibility: channel.visibility,
        },
      }),
    ),
  );
}

export async function addMemberToInstituteChannels(
  userId: string,
  instituteId: string,
  role: "STUDENT" | "TEACHER" | "MANAGER" | "ADMIN" | "SALES_MANAGER" | string,
) {
  const channels = await ensureInstituteChannels(instituteId);
  const allowed = channels.filter(({ channelType }: any) => {
    if (channelType === "TEACHERS") {
      return role === "TEACHER" || role === "MANAGER" || role === "ADMIN";
    }
    return true;
  });

  await Promise.all(
    allowed.map((conversation: any) =>
      prisma.conversationParticipant.upsert({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId,
          },
        },
        create: {
          conversationId: conversation.id,
          userId,
          role: role === "ADMIN" ? "ADMIN" : role === "MANAGER" ? "MANAGER" : "MEMBER",
        },
        update: { leftAt: null, status: "ACTIVE", isHidden: false },
      }),
    ),
  );
}
