import { sendEmail } from "@/lib/notifications/email";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import {
  buildLifeCoachWhatsAppMessage,
  buildLifeCoachEmailHtml,
} from "./lifeCoachTemplates";

export interface LifeCoachNotificationInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
}

/**
 * Sends automatic Email and WhatsApp messages to individuals who submit a Life Coach request.
 */
export async function sendLifeCoachSubmissionNotifications({
  fullName,
  phone,
  email,
}: LifeCoachNotificationInput) {
  const results = {
    whatsappSent: false,
    emailSent: false,
    whatsappError: null as any,
    emailError: null as any,
  };

  // 1. Send WhatsApp Notification
  if (phone) {
    try {
      const waMessage = buildLifeCoachWhatsAppMessage({ fullName });
      const waRes = await sendWhatsAppMessage(phone, waMessage);

      if (waRes.success) {
        results.whatsappSent = true;
        console.log(`[Life Coach] Automated WhatsApp message sent to ${phone}`);
      } else {
        results.whatsappError = waRes.error;
        console.warn(`[Life Coach] WhatsApp sending warning for ${phone}:`, waRes.error);
      }
    } catch (err) {
      results.whatsappError = err;
      console.error(`[Life Coach] Failed to send WhatsApp message to ${phone}:`, err);
    }
  } else {
    console.warn(`[Life Coach] No phone provided for ${fullName}, skipping WhatsApp.`);
  }

  // 2. Send Email Notification
  if (email && email.trim()) {
    try {
      const subject = "You’ve come to the right place! - AcademyFind Life Coaching";
      const html = buildLifeCoachEmailHtml({ fullName });
      const emailRes = await sendEmail(email.trim(), subject, html);

      if (emailRes.success) {
        results.emailSent = true;
        console.log(`[Life Coach] Automated confirmation email sent to ${email}`);
      } else {
        results.emailError = emailRes.error;
        console.warn(`[Life Coach] Email sending warning for ${email}:`, emailRes.error);
      }
    } catch (err) {
      results.emailError = err;
      console.error(`[Life Coach] Failed to send confirmation email to ${email}:`, err);
    }
  } else {
    console.log(`[Life Coach] No email provided for ${fullName}, skipping Email.`);
  }

  return results;
}
