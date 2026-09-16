/**
 * Pure template functions for Life Coach submission notifications (WhatsApp & Email).
 * Safe to import in both client and server contexts.
 * Uses ASCII-safe Unicode escape sequences for emojis and special punctuation
 * to prevent Windows ANSI / Latin-1 encoding corruption (question marks).
 */

export interface LifeCoachTemplateInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
}

/**
 * Builds the exact WhatsApp message formatted for Life Coach submissions.
 * Unicode escapes:
 * \uD83D\uDE0A = 😊 (Smiling Face)
 * \uD83D\uDCAC = 💬 (Speech Bubble)
 * \uD83C\uDF31 = 🌱 (Seedling)
 * \uD83C\uDF10 = 🌐 (Globe)
 * \uD83D\uDCDE = 📞 (Telephone)
 */
export function buildLifeCoachWhatsAppMessage({
  fullName,
}: {
  fullName: string;
}): string {
  const name = fullName?.trim() || "there";

  return `Hello ${name},

You've come to the right place! \uD83D\uDE0A

Thank you for reaching out to AcademyFind regarding Life Coaching.

*AcademyFind* helps you discover the right coaches, institutes and learning opportunities based on your needs \u2014 so you can make a more informed choice.

\uD83D\uDCAC You can simply share your question or requirement here, and we'll help you with it.

Alternatively, let us know a suitable time to connect, and our counselor will be happy to speak with you.

Looking forward to helping you find the right guidance. \uD83C\uDF31

Team AcademyFind
\uD83C\uDF10 www.AcademyFind.com
\uD83D\uDCDE 9045699938`;
}

/**
 * Builds a responsive, branded HTML email template matching the Life Coach submission message.
 */
export function buildLifeCoachEmailHtml({
  fullName,
}: {
  fullName: string;
}): string {
  const name = fullName?.trim() || "there";
  const whatsappUrl = `https://wa.me/919045699938?text=${encodeURIComponent(
    `Hello AcademyFind, I have an enquiry regarding Life Coaching (${name}).`
  )}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AcademyFind - Life Coaching</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 32px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">AcademyFind</h1>
              <p style="margin: 6px 0 0; color: #fef3c7; font-size: 13px; font-weight: 500;">Personalized 1-on-1 Mentorship &amp; Education Discovery</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.6; color: #0f172a;">
                Hello <strong>${name}</strong>,
              </p>
              
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 8px; margin: 0 0 20px;">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #b45309;">
                  You've come to the right place! \uD83D\uDE0A
                </p>
              </div>

              <p style="margin: 0 0 18px; font-size: 15px; color: #334155; line-height: 1.6;">
                Thank you for reaching out to AcademyFind regarding <strong>Life Coaching</strong>.
              </p>

              <p style="margin: 0 0 22px; font-size: 15px; color: #334155; line-height: 1.6;">
                <strong>AcademyFind</strong> helps you discover the right coaches, institutes and learning opportunities based on your needs &mdash; so you can make a more informed choice.
              </p>

              <!-- Action Prompt Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 15px; color: #0f172a; line-height: 1.6;">
                      \uD83D\uDCAC <strong>Share your questions:</strong> You can simply reply to this email or send your question or requirement directly on WhatsApp, and we'll help you with it.
                    </p>
                    <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
                      Alternatively, let us know a suitable time to connect, and our counselor will be happy to speak with you.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Buttons -->
              <div style="text-align: center; margin: 30px 0 24px;">
                <a href="${whatsappUrl}" target="_blank" style="background-color: #25d366; color: #ffffff; padding: 13px 26px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 8px; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.25);">
                  \uD83D\uDCAC Chat on WhatsApp
                </a>
                <a href="https://www.academyfind.com" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 13px 26px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);">
                  \uD83C\uDF10 Visit Website
                </a>
              </div>

              <p style="margin: 28px 0 20px; font-size: 15px; color: #334155; line-height: 1.6;">
                Looking forward to helping you find the right guidance. \uD83C\uDF31
              </p>

              <!-- Sign-off -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px;">
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                  Team AcademyFind
                </p>
                <p style="margin: 6px 0 0; font-size: 14px; color: #64748b;">
                  \uD83C\uDF10 <a href="https://www.academyfind.com" target="_blank" style="color: #d97706; text-decoration: none; font-weight: 600;">www.AcademyFind.com</a>
                </p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #64748b;">
                  \uD83D\uDCDE <a href="tel:9045699938" style="color: #0f172a; text-decoration: none; font-weight: 600;">9045699938</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer Note -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                You are receiving this message because you requested Life Coaching guidance on AcademyFind.
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
