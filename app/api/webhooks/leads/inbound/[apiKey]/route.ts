import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStandardizedLead } from "@/lib/crm/crmLeadService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  try {
    const { apiKey } = await params;
    const { searchParams } = new URL(request.url);

    // 1. Meta Webhook Verification (hub.mode = subscribe)
    const hubMode = searchParams.get("hub.mode");
    const hubVerifyToken = searchParams.get("hub.verify_token");
    const hubChallenge = searchParams.get("hub.challenge");

    if (hubMode === "subscribe" && hubVerifyToken && hubChallenge) {
      if (hubVerifyToken === apiKey) {
        return new NextResponse(hubChallenge, { status: 200 });
      }
      return new NextResponse("Forbidden - Verification Token Mismatch", { status: 403 });
    }

    // 2. Health check / status inspection for integration
    const integration = await prisma.inboundLeadIntegration.findUnique({
      where: { apiKey },
      include: {
        institute: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            isActive: true,
          },
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration endpoint not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: integration.isActive ? "active" : "inactive",
      provider: integration.provider,
      institute: integration.institute.name,
      totalLeadsReceived: integration.totalLeadsReceived,
      lastLeadAt: integration.lastLeadAt,
    });
  } catch (error: any) {
    console.error("Inbound webhook GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  try {
    const { apiKey } = await params;

    // 1. Find integration
    const integration = await prisma.inboundLeadIntegration.findUnique({
      where: { apiKey },
      include: {
        institute: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            planExpiresAt: true,
            isActive: true,
          },
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Invalid API Key or integration not found" },
        { status: 401 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        { success: false, error: "This lead integration is currently disabled" },
        { status: 403 }
      );
    }

    // 2. Plan check (Premium or Ultra required)
    const plan = integration.institute.subscriptionPlan;
    const isPremiumTier = plan === "PREMIUM" || plan === "ULTRA";

    if (!isPremiumTier) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead integrations are available exclusively for Premium and Ultra plans",
        },
        { status: 403 }
      );
    }

    // Check plan expiration if set
    if (
      integration.institute.planExpiresAt &&
      new Date(integration.institute.planExpiresAt) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: "Institute subscription plan has expired" },
        { status: 403 }
      );
    }

    // 3. Parse payload (supports JSON and form-data/urlencoded)
    let body: any = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch (err) {
        return NextResponse.json(
          { success: false, error: "Invalid JSON payload" },
          { status: 400 }
        );
      }
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      const obj: Record<string, any> = {};
      formData.forEach((value, key) => {
        obj[key] = value;
      });
      body = obj;
    } else {
      try {
        body = await request.json();
      } catch {
        const text = await request.text();
        body = { rawText: text };
      }
    }

    // 4. Extract lead data based on provider / payload shape
    let name: string = "";
    let phone: string = "";
    let email: string = "";
    let message: string = "";
    let sourceDetails: Record<string, any> = {
      provider: integration.provider,
      integrationId: integration.id,
      receivedAt: new Date().toISOString(),
    };

    // A. GOOGLE ADS LEAD FORM EXTENSION PAYLOAD
    if (body.user_column_data && Array.isArray(body.user_column_data)) {
      sourceDetails.googleLeadId = body.lead_id;
      sourceDetails.googleFormId = body.form_id;
      sourceDetails.googleCampaignId = body.campaign_id;
      sourceDetails.googleKey = body.google_key;

      for (const col of body.user_column_data) {
        const colId = (col.column_id || "").toUpperCase();
        const val = col.string_value || "";

        if (colId === "FULL_NAME" || colId === "NAME") {
          name = val;
        } else if (colId === "FIRST_NAME") {
          name = name ? `${val} ${name}` : val;
        } else if (colId === "LAST_NAME") {
          name = name ? `${name} ${val}` : val;
        } else if (colId === "PHONE_NUMBER" || colId === "PHONE") {
          phone = val;
        } else if (colId === "EMAIL") {
          email = val;
        } else if (colId === "CITY" || colId === "POSTAL_CODE") {
          sourceDetails[colId.toLowerCase()] = val;
        } else {
          sourceDetails[colId.toLowerCase()] = val;
        }
      }
    }
    // B. META ADS WEBHOOK PAYLOAD (with leadgen_id)
    else if (
      body.entry &&
      Array.isArray(body.entry) &&
      body.entry[0]?.changes &&
      body.entry[0]?.changes[0]?.value?.leadgen_id
    ) {
      const changeVal = body.entry[0].changes[0].value;
      const leadgenId = changeVal.leadgen_id;
      sourceDetails.metaLeadgenId = leadgenId;
      sourceDetails.metaPageId = changeVal.page_id;
      sourceDetails.metaFormId = changeVal.form_id;
      sourceDetails.metaAdId = changeVal.ad_id;
      sourceDetails.metaCampaignId = changeVal.campaign_id;

      // If Page Access Token is configured in integration config, attempt Graph API fetch
      const cfg = (integration.config as any) || {};
      const accessToken = cfg.metaAccessToken || cfg.accessToken;

      if (accessToken) {
        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${accessToken}`
          );
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            sourceDetails.metaGraphData = metaData;
            if (metaData.field_data && Array.isArray(metaData.field_data)) {
              for (const field of metaData.field_data) {
                const fname = (field.name || "").toLowerCase();
                const fval = field.values?.[0] || "";
                if (fname.includes("name")) name = fval;
                else if (fname.includes("phone")) phone = fval;
                else if (fname.includes("email")) email = fval;
                else if (fname.includes("city") || fname.includes("course")) {
                  sourceDetails[fname] = fval;
                }
              }
            }
          } else {
            console.warn("Meta Graph API fetch returned status", metaRes.status);
          }
        } catch (graphErr) {
          console.error("Meta Graph API fetch error:", graphErr);
        }
      }

      if (!name) name = `Meta Lead (${leadgenId})`;
      if (!phone) phone = "Awaiting Meta Sync";
    }
    // C. GENERIC / WEBSITE / ZAPIER / ELEMENTOR / FORM PAYLOAD
    else {
      // Find name
      name =
        body.name ||
        body.fullName ||
        body.full_name ||
        body.student_name ||
        body.studentName ||
        body.firstName ||
        body.first_name ||
        body["your-name"] ||
        body.lead_name ||
        "";

      if (!name && (body.firstName || body.first_name)) {
        name = `${body.firstName || body.first_name} ${body.lastName || body.last_name || ""}`.trim();
      }

      // Find phone
      phone =
        body.phone ||
        body.mobile ||
        body.phoneNumber ||
        body.phone_number ||
        body.contact ||
        body.contactNumber ||
        body.contact_number ||
        body.mobileNumber ||
        body.mobile_number ||
        body["your-phone"] ||
        body.tel ||
        "";

      // Find email
      email =
        body.email ||
        body.student_email ||
        body.studentEmail ||
        body["your-email"] ||
        body.email_address ||
        "";

      // Find message / course / notes
      message =
        body.message ||
        body.course ||
        body.query ||
        body.notes ||
        body.subject ||
        body["your-message"] ||
        body.grade ||
        "";

      sourceDetails.raw = body;
    }

    // Clean up string values
    name = (name || "Prospective Student").trim();
    phone = (phone || "").replace(/[^\d+]/g, "").trim();
    email = (email || "").trim();

    // Validation: Phone or Email is required
    if (!phone && !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required contact field: phone or email is required to create a lead",
        },
        { status: 400 }
      );
    }

    // Default phone fallback if lead only provided email
    if (!phone && email) {
      phone = "Email-Only Lead";
    }

    // Determine normalized source string
    let sourceString = "EXTERNAL_WEBHOOK";
    switch (integration.provider) {
      case "META":
        sourceString = "META_ADS";
        break;
      case "GOOGLE":
        sourceString = "GOOGLE_ADS";
        break;
      case "WEBSITE_WEBHOOK":
        sourceString = "WEBSITE_WEBHOOK";
        break;
      case "ZAPIER":
        sourceString = "ZAPIER";
        break;
      case "LINKEDIN":
        sourceString = "LINKEDIN";
        break;
      default:
        sourceString = "EXTERNAL_WEBHOOK";
    }

    // 5. Check for rapid duplicate (same phone & institute in last 2 minutes)
    if (phone && phone !== "Email-Only Lead" && phone !== "Awaiting Meta Sync") {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const duplicate = await prisma.inboundLead.findFirst({
        where: {
          instituteId: integration.instituteId,
          phone,
          createdAt: { gte: twoMinutesAgo },
        },
      });

      if (duplicate) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          leadId: duplicate.id,
          message: "Duplicate lead within 2 minutes acknowledged",
        });
      }
    }

    // 6. Create standardized lead in CRM enquiry database with auto-welcome email & activity tracking
    const lead = await createStandardizedLead({
      instituteId: integration.instituteId,
      name,
      phone,
      email: email || null,
      message: message || `Captured via ${integration.provider} integration (${integration.name || "Inbound Webhook"})`,
      source: sourceString,
      sourceDetails,
      status: "NEW",
      creatorRole: "INBOUND_WEBHOOK",
      creatorName: integration.name || integration.provider,
    });

    // Also persist in inboundLead for integration historical logs
    await prisma.inboundLead.create({
      data: {
        integrationId: integration.id,
        instituteId: integration.instituteId,
        name,
        phone,
        email: email || null,
        message: message || `Captured via ${integration.provider} integration (${integration.name || "Inbound Webhook"})`,
        source: sourceString,
        sourceDetails,
        status: "NEW",
      },
    }).catch(() => null);

    // 7. Update integration stats
    await prisma.inboundLeadIntegration.update({
      where: { id: integration.id },
      data: {
        totalLeadsReceived: { increment: 1 },
        lastLeadAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        institute: integration.institute.name,
        source: sourceString,
        message: "Lead successfully recorded in AcademyFind CRM",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Inbound webhook POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process inbound lead" },
      { status: 500 }
    );
  }
}
