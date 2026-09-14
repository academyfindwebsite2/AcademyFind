import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

interface BlogNotificationInput {
  userId?: string;
  writerName: string;
  articleTitle: string;
  authorEmail?: string | null;
  authorPhone?: string | null;
  claimUrl?: string;
}

import {
  buildBlogSubmissionWhatsAppMessage,
  buildBlogSubmissionEmailHtml,
} from "./blogTemplates";

export {
  buildBlogSubmissionWhatsAppMessage,
  buildBlogSubmissionEmailHtml,
};



/**
 * Dispatches automated Email and WhatsApp notification to the blog writer upon submission.
 */
export async function sendBlogSubmissionNotification({
  userId,
  writerName,
  articleTitle,
  authorEmail,
  authorPhone,
  claimUrl,
}: BlogNotificationInput) {
  let email = authorEmail;
  let phone = authorPhone;

  // If email or phone is missing and userId exists, fetch user record
  if ((!email || !phone) && userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true, name: true },
      });
      if (user) {
        if (!email && user.email) email = user.email;
        if (!phone && user.phone) phone = user.phone;
      }
    } catch (dbErr) {
      console.warn("Could not fetch user record for blog submission notification:", dbErr);
    }
  }

  const results = {
    emailSent: false,
    whatsappSent: false,
    emailError: null as any,
    whatsappError: null as any,
  };

  // 1. Send Email Notification
  if (email) {
    try {
      const subject = `Thank you for submitting your article: “${articleTitle}” - AcademyFind`;
      const html = buildBlogSubmissionEmailHtml({
        writerName,
        articleTitle,
        claimUrl,
      });

      const emailRes = await sendEmail(email, subject, html);
      if (emailRes.success) {
        results.emailSent = true;
        console.log(`[Blog Submission] Automated confirmation email sent to ${email}`);
      } else {
        results.emailError = emailRes.error;
      }
    } catch (err) {
      console.error(`[Blog Submission] Failed to send email to ${email}:`, err);
      results.emailError = err;
    }
  } else {
    console.warn(`[Blog Submission] No email available for writer "${writerName}" (userId: ${userId})`);
  }

  // 2. Send WhatsApp Notification
  if (phone) {
    try {
      const waMessage = buildBlogSubmissionWhatsAppMessage({
        writerName,
        articleTitle,
      });

      const waRes = await sendWhatsAppMessage(phone, waMessage);
      if (waRes.success) {
        results.whatsappSent = true;
        console.log(`[Blog Submission] Automated WhatsApp message sent to ${phone}`);
      } else {
        results.whatsappError = waRes.error;
      }
    } catch (err) {
      console.error(`[Blog Submission] Failed to send WhatsApp to ${phone}:`, err);
      results.whatsappError = err;
    }
  } else {
    console.log(`[Blog Submission] No phone number recorded for writer "${writerName}" (userId: ${userId})`);
  }

  return results;
}
