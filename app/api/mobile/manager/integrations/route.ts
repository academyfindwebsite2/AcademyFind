import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import crypto from 'crypto';

async function checkAccess(instituteId: string) {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized', status: 401 };

  const isManager = await prisma.instituteManager.findFirst({
    where: { userId: session.user.id, instituteId }
  });

  if (!isManager && session.user.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 };
  }

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { id: true, name: true, subscriptionPlan: true }
  });

  if (!institute) return { error: 'Institute not found', status: 404 };

  const isPremium = institute.subscriptionPlan === 'PREMIUM' || institute.subscriptionPlan === 'ULTRA';
  return { success: true, isPremium, institute };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instituteId = searchParams.get('instituteId');
    if (!instituteId) return NextResponse.json({ success: false, error: 'Institute ID missing' }, { status: 400 });

    const access = await checkAccess(instituteId);
    if (access.error) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

    if (!access.isPremium) {
      return NextResponse.json({
        success: true,
        data: {
          isLocked: true,
          plan: access.institute?.subscriptionPlan,
          instituteName: access.institute?.name,
          inboundIntegrations: [],
          outboundIntegrations: [],
          integrations: [],
        }
      });
    }

    const [inboundIntegrations, outboundIntegrations] = await Promise.all([
      prisma.inboundLeadIntegration.findMany({
        where: { instituteId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cRMIntegration.findMany({
        where: { instituteId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        isLocked: false,
        plan: access.institute?.subscriptionPlan,
        instituteName: access.institute?.name,
        inboundIntegrations,
        outboundIntegrations,
        // Legacy fallback
        integrations: outboundIntegrations,
      }
    });
  } catch (error: any) {
    console.error('Manager Integrations GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const {
      type = 'OUTBOUND', // 'INBOUND' | 'OUTBOUND'
      instituteId,
      provider,
      name,
      webhookUrl,
      config,
      sendEnquiries,
      sendUserSaves,
      sendUserVisits,
    } = data;

    if (!instituteId) return NextResponse.json({ success: false, error: 'Institute ID is required' }, { status: 400 });

    const access = await checkAccess(instituteId);
    if (access.error || !access.isPremium) {
      return NextResponse.json({ success: false, error: access.error || 'Upgrade to Premium or Ultra required' }, { status: 403 });
    }

    // Handle INBOUND Lead Capture Integration (Meta, Google, Website, Zapier)
    if (type === 'INBOUND') {
      const validProviders = ['META', 'GOOGLE', 'WEBSITE_WEBHOOK', 'ZAPIER', 'LINKEDIN'];
      const targetProvider = validProviders.includes(provider) ? provider : 'WEBSITE_WEBHOOK';

      const randomSuffix = crypto.randomBytes(16).toString('hex');
      const apiKey = `af_${targetProvider.toLowerCase()}_${randomSuffix}`;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academyfind.com';
      const generatedWebhookUrl = `${baseUrl}/api/webhooks/leads/inbound/${apiKey}`;

      const inboundIntegration = await prisma.inboundLeadIntegration.create({
        data: {
          instituteId,
          provider: targetProvider,
          name: name?.trim() || `${targetProvider} Campaign`,
          apiKey,
          webhookUrl: generatedWebhookUrl,
          config: config || {},
          isActive: true,
        },
      });

      return NextResponse.json({ success: true, data: inboundIntegration, integration: inboundIntegration });
    }

    // Handle OUTBOUND CRM Integration (Zoho, Salesforce, HubSpot, Custom Webhook)
    if (!webhookUrl?.trim()) {
      return NextResponse.json({ success: false, error: 'Webhook destination URL is required' }, { status: 400 });
    }

    const outboundIntegration = await prisma.cRMIntegration.create({
      data: {
        instituteId,
        provider: provider || 'CUSTOM',
        webhookUrl: webhookUrl.trim(),
        sendEnquiries: sendEnquiries !== undefined ? !!sendEnquiries : true,
        sendUserSaves: !!sendUserSaves,
        sendUserVisits: !!sendUserVisits,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: outboundIntegration, integration: outboundIntegration });
  } catch (error: any) {
    console.error('Manager Integrations POST Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const {
      type = 'OUTBOUND', // 'INBOUND' | 'OUTBOUND'
      action, // 'TEST_LEAD' | 'REGENERATE_KEY' | undefined
      id,
      instituteId,
      name,
      provider,
      webhookUrl,
      sendEnquiries,
      sendUserSaves,
      sendUserVisits,
      isActive,
      config,
    } = data;

    if (!id || !instituteId) {
      return NextResponse.json({ success: false, error: 'Integration ID and Institute ID are required' }, { status: 400 });
    }

    const access = await checkAccess(instituteId);
    if (access.error || !access.isPremium) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Special Action: Simulate Test Lead for Inbound Integration
    if (action === 'TEST_LEAD') {
      const integration = await prisma.inboundLeadIntegration.findUnique({
        where: { id },
      });
      if (!integration || integration.instituteId !== instituteId) {
        return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 });
      }

      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const mockNames = ['Rohan Verma', 'Priya Singh', 'Amit Patel', 'Ananya Sharma', 'Vikram Reddy'];
      const mockCourses = ['JEE Advanced Prep', 'NEET Medical Coaching', 'Foundation Batch', 'Spoken English & IELTS', 'UPSC Civil Services'];
      const mockName = mockNames[Math.floor(Math.random() * mockNames.length)];
      const mockCourse = mockCourses[Math.floor(Math.random() * mockCourses.length)];
      const mockPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
      const mockEmail = `${mockName.toLowerCase().replace(/\s+/g, '.')}${randomNum}@gmail.com`;

      let sourceStr = 'EXTERNAL_WEBHOOK';
      if (integration.provider === 'META') sourceStr = 'META_ADS';
      else if (integration.provider === 'GOOGLE') sourceStr = 'GOOGLE_ADS';
      else if (integration.provider === 'WEBSITE_WEBHOOK') sourceStr = 'WEBSITE_WEBHOOK';
      else if (integration.provider === 'ZAPIER') sourceStr = 'ZAPIER';

      const lead = await prisma.inboundLead.create({
        data: {
          integrationId: integration.id,
          instituteId,
          name: `[Test Lead] ${mockName}`,
          phone: mockPhone,
          email: mockEmail,
          message: `Inquired for: ${mockCourse} · Simulated test lead via ${integration.provider} integration (${integration.name || 'Default Campaign'})`,
          source: sourceStr,
          sourceDetails: {
            isSimulation: true,
            provider: integration.provider,
            integrationId: integration.id,
            campaign: integration.name || 'Test Campaign',
            simulatedAt: new Date().toISOString(),
          },
          status: 'NEW',
        },
      });

      await prisma.inboundLeadIntegration.update({
        where: { id },
        data: {
          totalLeadsReceived: { increment: 1 },
          lastLeadAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Test lead created successfully for ${mockName} (${mockCourse})!`,
        lead,
      });
    }

    // Special Action: Regenerate Inbound API Key
    if (action === 'REGENERATE_KEY') {
      const integration = await prisma.inboundLeadIntegration.findUnique({
        where: { id },
      });
      if (!integration || integration.instituteId !== instituteId) {
        return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 });
      }

      const randomSuffix = crypto.randomBytes(16).toString('hex');
      const newApiKey = `af_${integration.provider.toLowerCase()}_${randomSuffix}`;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academyfind.com';
      const newWebhookUrl = `${baseUrl}/api/webhooks/leads/inbound/${newApiKey}`;

      const updated = await prisma.inboundLeadIntegration.update({
        where: { id },
        data: {
          apiKey: newApiKey,
          webhookUrl: newWebhookUrl,
        },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // Handle Normal Update for INBOUND
    if (type === 'INBOUND') {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (config !== undefined) updateData.config = config;

      const updated = await prisma.inboundLeadIntegration.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // Handle Normal Update for OUTBOUND CRM
    const updateData: any = {};
    if (provider !== undefined) updateData.provider = provider;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (sendEnquiries !== undefined) updateData.sendEnquiries = sendEnquiries;
    if (sendUserSaves !== undefined) updateData.sendUserSaves = sendUserSaves;
    if (sendUserVisits !== undefined) updateData.sendUserVisits = sendUserVisits;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.cRMIntegration.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Manager Integrations PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const instituteId = searchParams.get('instituteId');
    const type = searchParams.get('type') || 'OUTBOUND';

    if (!id || !instituteId) return NextResponse.json({ success: false, error: 'Missing ID or Institute ID' }, { status: 400 });

    const access = await checkAccess(instituteId);
    if (access.error || !access.isPremium) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    if (type === 'INBOUND') {
      await prisma.inboundLeadIntegration.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    }

    await prisma.cRMIntegration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Manager Integrations DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
