import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";

// GET /api/ism/wa-log/[enquiryId]?phone=XXXX&name=YYYY&institute=ZZZZ
// Auto-logs a WhatsApp contact action and redirects to the WA link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enquiryId: string }> }
) {
  const { enquiryId } = await params;
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") || "";
  const studentName = searchParams.get("name") || "";
  const instituteName = searchParams.get("institute") || "";

  // Log the activity (best-effort — don't fail the redirect if this errors)
  try {
    const session = await getSession();
    if (session?.user) {
      const enquiry = await prisma.instituteEnquiry.findUnique({
        where: { id: enquiryId },
        select: { assignedIsmId: true },
      });

      const ismId = enquiry?.assignedIsmId || session.user.id;

      await prisma.ismLeadActivity.create({
        data: {
          enquiryId,
          ismId,
          type: "WHATSAPP_SENT",
          content: `WhatsApp message sent to ${studentName} (${phone})`,
        },
      });

      // Update status to MESSAGED if currently NEW
      await prisma.instituteEnquiry.updateMany({
        where: { id: enquiryId, status: { in: ["NEW", "PENDING"] } },
        data: {
          status: "MESSAGED",
          lastUpdatedByRole: session.user.role,
          lastUpdatedByName: session.user.name || "ISM",
        },
      });
    }
  } catch (err) {
    console.error("WA log error (non-fatal):", err);
  }

  // Build the WhatsApp URL and redirect
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const waNumber = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const message = encodeURIComponent(
    `Hello ${studentName}, thank you for your enquiry about ${instituteName}. How can we help you?`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${message}`;

  return NextResponse.redirect(waUrl);
}
