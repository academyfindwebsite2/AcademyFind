"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { revalidatePath } from "next/cache";

export interface CommTemplate {
  id: string;
  title: string;
  type: "WHATSAPP" | "EMAIL";
  subject?: string | null;
  content: string;
  isCustom: boolean;
}

const DEFAULT_TEMPLATES: CommTemplate[] = [
  // WhatsApp Templates
  {
    id: "wa-intro",
    title: "1. Welcome & Introduction",
    type: "WHATSAPP",
    content:
      "Hello {name} 👋 Thank you for your enquiry at {instituteName} regarding {course}. We would love to guide you through our batches, syllabus, and faculty details. When is a good time for a quick 5-minute call?",
    isCustom: false,
  },
  {
    id: "wa-brochure",
    title: "2. Course Details & Brochure",
    type: "WHATSAPP",
    content:
      "Hi {name}, as discussed, here are the details for {course} at {instituteName}. Our next batch is starting shortly with limited seats. Please review the curriculum and feel free to ask any questions!",
    isCustom: false,
  },
  {
    id: "wa-fees",
    title: "3. Fee Structure & Easy Installments",
    type: "WHATSAPP",
    content:
      "Dear {name}, here is the fee breakdown for {course} at {instituteName}. We also offer flexible installment plans and scholarship discounts for deserving candidates. Let us know if you would like to reserve your seat!",
    isCustom: false,
  },
  {
    id: "wa-followup",
    title: "4. Follow-up Reminder",
    type: "WHATSAPP",
    content:
      "Hi {name}, following up on our previous conversation regarding your admission for {course} at {instituteName}. Batches are filling up fast! Are you still looking to enroll?",
    isCustom: false,
  },
  {
    id: "wa-admission",
    title: "5. Admission Confirmation",
    type: "WHATSAPP",
    content:
      "Congratulations {name}! 🎉 Your admission for {course} at {instituteName} has been recorded. Our team will share your student ID, batch schedule, and classroom details shortly. Welcome aboard!",
    isCustom: false,
  },

  // Email Templates
  {
    id: "email-course-info",
    title: "Course Overview & Admission Guidelines",
    type: "EMAIL",
    subject: "Information regarding {course} at {instituteName}",
    content: `Dear {name},

Thank you for expressing interest in {instituteName}. We are thrilled to assist you with your academic goals for {course}.

Our program is designed to deliver top-tier mentorship, comprehensive study materials, and rigorous testing series to ensure you achieve your target goals.

Next Steps:
• Schedule a free one-on-one counseling session
• Attend an orientation demo class
• Discuss customized batch timings & installment plans

Feel free to reply directly to this email or reach us by phone/WhatsApp.

Warm regards,
Admissions Office
{instituteName}`,
    isCustom: false,
  },
  {
    id: "email-fee-quote",
    title: "Official Fee Quotation & Installment Schedule",
    type: "EMAIL",
    subject: "Fee Details & Installment Options: {course} - {instituteName}",
    content: `Dear {name},

Thank you for your conversation with our counseling team regarding {course} at {instituteName}.

We are pleased to share the fee quotation and installment flexibility for the upcoming academic session.

Please review our payment schedule options and confirm your preferred mode so we can reserve your seat and initiate enrollment.

Feel free to reply directly to this email if you have any questions.

Best regards,
Admissions & Accounts
{instituteName}`,
    isCustom: false,
  },
];

/**
 * Fetches templates for an institute (combining custom institute templates with defaults)
 */
export async function getCommunicationTemplates(
  instituteId: string,
  type?: "WHATSAPP" | "EMAIL"
): Promise<CommTemplate[]> {
  try {
    const customDbTemplates = await prisma.instituteCommunicationTemplate.findMany({
      where: {
        instituteId,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const customList: CommTemplate[] = customDbTemplates.map((t: any) => ({
      id: t.id,
      title: t.title,
      type: t.type as "WHATSAPP" | "EMAIL",
      subject: t.subject,
      content: t.content,
      isCustom: true,
    }));

    const defaultFiltered = DEFAULT_TEMPLATES.filter(
      (t: any) => !type || t.type === type
    );

    return [...customList, ...defaultFiltered];
  } catch (err) {
    console.error("getCommunicationTemplates error:", err);
    return DEFAULT_TEMPLATES.filter((t: any) => !type || t.type === type);
  }
}

/**
 * Logs that an email was prepared and opened in Gmail / default mail app by the manager
 */
export async function logLeadEmailInitiated(
  enquiryId: string,
  subject: string,
  templateTitle?: string,
  clientType: "GMAIL" | "DEFAULT_MAIL" = "GMAIL"
) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const enquiry = await prisma.instituteEnquiry.findUnique({
    where: { id: enquiryId },
    select: { id: true, instituteId: true, assignedIsmId: true },
  });
  if (!enquiry) return { success: false, error: "Lead not found" };

  // Immutable activity entry
  await prisma.ismLeadActivity.create({
    data: {
      enquiryId,
      ismId: enquiry.assignedIsmId || session.user.id,
      type: "EMAIL_SENT",
      content: `Email prepared via ${clientType === "GMAIL" ? "Gmail" : "Mail app"}: "${subject}"${templateTitle ? ` (Template: ${templateTitle})` : ""}`,
      meta: {
        subject,
        templateTitle,
        clientType,
        senderId: session.user.id,
        senderName: session.user.name || "Manager",
      },
    },
  });

  revalidatePath(`/manager/${enquiry.instituteId}/leads/${enquiryId}`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads`);
  if (enquiry.assignedIsmId) {
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${enquiry.assignedIsmId}/leads/${enquiryId}`);
  }

  return { success: true };
}

/**
 * Backward-compatible alias for logLeadEmailInitiated
 */
export async function sendDirectLeadEmail(
  enquiryId: string,
  subject: string,
  _content?: string,
  templateTitle?: string
) {
  return logLeadEmailInitiated(enquiryId, subject, templateTitle, "GMAIL");
}

/**
 * Logs a WhatsApp message sent event into the immutable activity history
 */
export async function logLeadWhatsAppSent(
  enquiryId: string,
  templateTitle?: string,
  messagePreview?: string
) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const enquiry = await prisma.instituteEnquiry.findUnique({
    where: { id: enquiryId },
    select: { id: true, instituteId: true, assignedIsmId: true },
  });
  if (!enquiry) return { success: false, error: "Lead not found" };

  await prisma.ismLeadActivity.create({
    data: {
      enquiryId,
      ismId: enquiry.assignedIsmId || session.user.id,
      type: "WHATSAPP_SENT",
      content: `WhatsApp message initiated${templateTitle ? ` with template: "${templateTitle}"` : ""}`,
      meta: {
        templateTitle: templateTitle || "Custom Message",
        preview: messagePreview ? messagePreview.slice(0, 150) : null,
        actorId: session.user.id,
        actorName: session.user.name || "Manager",
      },
    },
  });

  revalidatePath(`/manager/${enquiry.instituteId}/leads/${enquiryId}`);
  revalidatePath(`/manager/${enquiry.instituteId}/leads`);
  if (enquiry.assignedIsmId) {
    revalidatePath(`/institute_sales/${enquiry.instituteId}/${enquiry.assignedIsmId}/leads/${enquiryId}`);
  }

  return { success: true };
}

/**
 * Creates or updates an institute communication template
 */
export async function saveCommunicationTemplate(
  instituteId: string,
  data: {
    id?: string;
    type: "WHATSAPP" | "EMAIL";
    title: string;
    subject?: string;
    content: string;
  }
) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Not authorized to manage templates" };
  }

  if (data.id) {
    await prisma.instituteCommunicationTemplate.update({
      where: { id: data.id },
      data: {
        title: data.title,
        type: data.type,
        subject: data.subject || null,
        content: data.content,
      },
    });
  } else {
    await prisma.instituteCommunicationTemplate.create({
      data: {
        instituteId,
        title: data.title,
        type: data.type,
        subject: data.subject || null,
        content: data.content,
      },
    });
  }

  revalidatePath(`/manager/${instituteId}/leads`);
  return { success: true };
}

/**
 * Deletes a custom communication template
 */
export async function deleteCommunicationTemplate(templateId: string, instituteId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const isManager = await prisma.instituteManager.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId } },
  });
  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Not authorized" };
  }

  await prisma.instituteCommunicationTemplate.delete({
    where: { id: templateId },
  });

  revalidatePath(`/manager/${instituteId}/leads`);
  return { success: true };
}
