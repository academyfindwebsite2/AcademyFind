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

/**
 * Builds the exact WhatsApp formatted message requested for blog submissions.
 */
export function buildBlogSubmissionWhatsAppMessage({
  writerName,
  articleTitle,
}: {
  writerName: string;
  articleTitle: string;
}): string {
  return `Hello ${writerName},
Greetings from AcademyFind.

Thank you for submitting your article, *“${articleTitle}.”* We appreciate your effort, and the article is very well written.

Before we can publish the articles, we kindly request you to claim your institute profile on AcademyFind. This will allow us to verify and associate your author profile with your institute and proceed with making the articles live on our platform.

Once the profile has been claimed, we will proceed with the publication.

Thank you for your cooperation. We look forward to featuring your article on AcademyFind.

Best regards,
Team AcademyFind
www.academyfind.com
9045699938

*About AcademyFind:*
AcademyFind is an education discovery and growth platform that connects students with the right institutes, teachers and learning opportunities. Students can discover, compare and connect with coaching institutes, tuition centres, tutors, sports, music, dance and other academies. For institutions, AcademyFind provides enhanced visibility, real-time student enquiries and an *Enquiry Management System* to help them manage, track and follow up on enquiries efficiently — all in one platform.`;
}

/**
 * Builds the responsive, branded HTML email template matching the exact message requested.
 */
export function buildBlogSubmissionEmailHtml({
  writerName,
  articleTitle,
  claimUrl = "https://www.academyfind.com/claim",
}: {
  writerName: string;
  articleTitle: string;
  claimUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Submission - AcademyFind</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 28px 32px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">AcademyFind</h1>
              <p style="margin: 4px 0 0; color: #ffedd5; font-size: 13px; font-weight: 500;">India's Leading Education & Coaching Discovery Platform</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #0f172a;">
                Hello <strong>${writerName}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.6;">
                Greetings from AcademyFind.
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6;">
                Thank you for submitting your article, <strong>“${articleTitle}.”</strong> We appreciate your effort, and the article is very well written.
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6;">
                Before we can publish the articles, we kindly request you to claim your institute profile on AcademyFind. This will allow us to verify and associate your author profile with your institute and proceed with making the articles live on our platform.
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">
                Once the profile has been claimed, we will proceed with the publication.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${claimUrl}" target="_blank" style="background-color: #ea580c; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
                  Claim Your Institute Profile
                </a>
              </div>

              <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">
                Thank you for your cooperation. We look forward to featuring your article on AcademyFind.
              </p>

              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">
                  Best regards,<br>
                  <strong>Team AcademyFind</strong><br>
                  <a href="https://www.academyfind.com" style="color: #ea580c; text-decoration: none; font-weight: 600;">www.academyfind.com</a><br>
                  <span style="color: #64748b;">Phone/WhatsApp: 9045699938</span>
                </p>
              </div>
            </td>
          </tr>

          <!-- About AcademyFind Section -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                About AcademyFind:
              </p>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                AcademyFind is an education discovery and growth platform that connects students with the right institutes, teachers and learning opportunities. Students can discover, compare and connect with coaching institutes, tuition centres, tutors, sports, music, dance and other academies. For institutions, AcademyFind provides enhanced visibility, real-time student enquiries and an <em style="color: #334155;">Enquiry Management System</em> to help them manage, track and follow up on enquiries efficiently — all in one platform.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 18px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} AcademyFind. All rights reserved. &bull; <a href="https://www.academyfind.com" style="color: #fdba74; text-decoration: none;">academyfind.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
