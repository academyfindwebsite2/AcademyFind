import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/auth/getMobileUserId";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const OFFICIAL_PLANS = [
  {
    id: "VERIFIED",
    name: "Verified",
    pricing: {
      monthly: { original: 499, offer: 199 },
      annual: { original: 2999, offer: 1999 },
    },
    desc: "Build trust and start capturing student leads.",
    features: [
      "Edit your profile",
      "Verified badge",
      "Institute name, address & contact details",
      "Detailed course information",
      "Appear in search results",
      "Direct lead generation from your institute page",
      "Access to AcademyFind resources",
    ],
  },
  {
    id: "PREMIUM",
    name: "Premium",
    pricing: {
      monthly: { original: 999, offer: 499 },
      annual: { original: 9999, offer: 4999 },
    },
    desc: "Showcase your institute, build your community, engage more students, and track your growth.",
    features: [
      "Everything in Verified",
      "See who viewed your profile",
      "Showcase your students and teachers",
      "Institute Forum",
      "Add social media links",
      "Photos and videos (institute gallery)",
      "Showcase results, achievements and testimonials",
      "Advanced profile analytics",
      "Priority enquiries (real-time)",
      "Dedicated support",
    ],
  },
  {
    id: "ULTRA",
    name: "Elite",
    pricing: {
      monthly: { original: 2999, offer: 999 },
      annual: { original: 29999, offer: 9999 },
    },
    desc: "Maximum visibility, top rankings and advanced lead management to grow your institute.",
    features: [
      "Everything in Premium",
      "Top position in your area & category",
      "Lead Management System (LMS) [NEW]",
      "Enquiry dashboard with complete lead details",
      "Automated follow-ups and status updates",
      "Student enquiry history and notes",
      "Team access for counsellors/staff",
      "Advanced analytics and performance reports",
      "Area-specific visibility (top in your area)",
      "Category-specific visibility (top in your category)",
      "Priority support and account management",
      "Early access to new features",
    ],
  },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const userId = await getMobileUserId(request);

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify manager access or admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      const manager = await prisma.instituteManager.findUnique({
        where: { userId_instituteId: { userId, instituteId } },
      });
      if (!manager) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptionPlan: true,
        planExpiresAt: true,
        isVerified: true,
      },
    });

    if (!institute) {
      return NextResponse.json({ success: false, error: "Institute not found" }, { status: 404 });
    }

    const latestApprovedPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        instituteId: institute.id,
        status: "APPROVED",
        planRequested: institute.subscriptionPlan,
      },
      orderBy: { createdAt: "desc" },
      select: { billingCycle: true, createdAt: true, amountPaid: true },
    });

    const pendingPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        instituteId: institute.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        planRequested: true,
        billingCycle: true,
        amountPaid: true,
        utrNumber: true,
        proofImageUrl: true,
        status: true,
        createdAt: true,
      },
    });

    const paymentDetails = {
      upiId: process.env.PAYMENT_UPI_ID || "",
      bankDetails: {
        bankName: process.env.PAYMENT_BANK_NAME || "",
        accountName: process.env.PAYMENT_ACCOUNT_NAME || "",
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "",
        ifscCode: process.env.PAYMENT_IFSC_CODE || "",
      },
      qrCodeUrl: "/payment_qr/payment.jpeg",
    };

    return NextResponse.json({
      success: true,
      data: {
        institute,
        currentPlan: institute.subscriptionPlan,
        currentBillingCycle: latestApprovedPayment?.billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY",
        pendingPayment,
        plans: OFFICIAL_PLANS,
        paymentDetails,
      },
    });
  } catch (error: any) {
    console.error("Manager subscription fetch error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const userId = await getMobileUserId(request);

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify manager access or admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      const manager = await prisma.instituteManager.findUnique({
        where: { userId_instituteId: { userId, instituteId } },
      });
      if (!manager) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
    }

    let planRequested = "";
    let billingCycle = "MONTHLY";
    let amountPaid = 0;
    let utrNumber = "";
    let base64Image: string | null = null;
    let uploadedFile: File | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      planRequested = (formData.get("planRequested") as string) || "";
      billingCycle = (formData.get("billingCycle") as string) || "MONTHLY";
      amountPaid = parseInt(formData.get("amountPaid") as string) || 0;
      utrNumber = ((formData.get("utrNumber") as string) || "").trim();
      uploadedFile = formData.get("imageFile") as File | null;
    } else {
      const body = await request.json();
      planRequested = body.planRequested || "";
      billingCycle = body.billingCycle || "MONTHLY";
      amountPaid = Number(body.amountPaid) || 0;
      utrNumber = (body.utrNumber || "").trim();
      base64Image = body.base64Image || null;
    }

    if (!["VERIFIED", "PREMIUM", "ULTRA"].includes(planRequested)) {
      return NextResponse.json({ success: false, error: "Invalid plan selected." }, { status: 400 });
    }

    if (!utrNumber || utrNumber.length < 6) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Transaction ID / UTR Number (minimum 6 digits)." },
        { status: 400 }
      );
    }

    // Check if UTR already exists
    const existingUtr = await prisma.subscriptionPayment.findUnique({
      where: { utrNumber },
    });

    if (existingUtr) {
      return NextResponse.json(
        { success: false, error: "This UTR number has already been submitted or used." },
        { status: 400 }
      );
    }

    let proofImageUrl: string | null = null;

    if (base64Image) {
      try {
        const dataUri = base64Image.startsWith("data:")
          ? base64Image
          : `data:image/jpeg;base64,${base64Image}`;
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: "academyfind/payments",
          public_id: `pay-${utrNumber}-${Date.now()}`,
          overwrite: true,
          format: "webp",
        });
        proofImageUrl = uploadResult.secure_url;
      } catch (err: any) {
        console.error("Cloudinary base64 upload error:", err);
      }
    } else if (uploadedFile && typeof uploadedFile === "object" && uploadedFile.size > 0) {
      try {
        const bytes = await uploadedFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const mimeType = uploadedFile.type || "image/jpeg";
        const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: "academyfind/payments",
          public_id: `pay-${utrNumber}-${Date.now()}`,
          overwrite: true,
          format: "webp",
        });
        proofImageUrl = uploadResult.secure_url;
      } catch (err: any) {
        console.error("Cloudinary file upload error:", err);
      }
    }

    const newPayment = await prisma.subscriptionPayment.create({
      data: {
        instituteId,
        userId,
        planRequested: planRequested as any,
        billingCycle: billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY",
        amountPaid,
        utrNumber,
        proofImageUrl,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment proof submitted! Admin will verify soon.",
      data: newPayment,
    });
  } catch (error: any) {
    console.error("Manager subscription submission error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit transaction details." },
      { status: 500 }
    );
  }
}
