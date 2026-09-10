import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") throw new Error("Admin access required");
  return session;
}

// GET: Inbound leads and integrations
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const instituteId = searchParams.get("instituteId") || "ALL";
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit")) || 30));

    const where: any = {};
    if (status !== "ALL") where.status = status;
    if (instituteId !== "ALL") where.instituteId = instituteId;
    if (provider !== "ALL") {
      const pUpper = provider.toUpperCase();
      if (pUpper.includes("GOOGLE")) {
        where.OR = [
          { integration: { provider: "GOOGLE" } },
          { source: { contains: "GOOGLE", mode: "insensitive" } },
        ];
      } else if (pUpper.includes("META")) {
        where.OR = [
          { integration: { provider: "META" } },
          { source: { contains: "META", mode: "insensitive" } },
        ];
      } else if (pUpper.includes("ZAPIER")) {
        where.OR = [
          { integration: { provider: "ZAPIER" } },
          { source: { contains: "ZAPIER", mode: "insensitive" } },
        ];
      } else {
        where.OR = [
          { integration: { provider: "WEBSITE_WEBHOOK" } },
          { source: { contains: "WEBHOOK", mode: "insensitive" } },
        ];
      }
    }

    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { institute: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [leads, total, integrations, stats] = await Promise.all([
      prisma.inboundLead.findMany({
        where,
        include: {
          institute: {
            select: {
              id: true,
              name: true,
              slug: true,
              subscriptionPlan: true,
              city: { select: { name: true } },
            },
          },
          integration: {
            select: {
              id: true,
              name: true,
              provider: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.inboundLead.count({ where }),
      prisma.inboundLeadIntegration.findMany({
        include: {
          institute: {
            select: {
              id: true,
              name: true,
              slug: true,
              subscriptionPlan: true,
            },
          },
          _count: { select: { leads: true } },
        },
        orderBy: { lastLeadAt: "desc" },
      }),
      Promise.all([
        prisma.inboundLead.count(),
        prisma.inboundLead.count({
          where: {
            OR: [
              { integration: { provider: "GOOGLE" } },
              { source: { contains: "GOOGLE", mode: "insensitive" } },
            ],
          },
        }),
        prisma.inboundLead.count({
          where: {
            OR: [
              { integration: { provider: "META" } },
              { source: { contains: "META", mode: "insensitive" } },
            ],
          },
        }),
        prisma.inboundLead.count({
          where: {
            OR: [
              { integration: { provider: "ZAPIER" } },
              { source: { contains: "ZAPIER", mode: "insensitive" } },
            ],
          },
        }),
        prisma.inboundLead.count({
          where: {
            OR: [
              { integration: { provider: "WEBSITE_WEBHOOK" } },
              { source: { contains: "WEBHOOK", mode: "insensitive" } },
            ],
          },
        }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        leads,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        integrations,
        stats: {
          total: stats[0],
          googleAds: stats[1],
          metaAds: stats[2],
          zapier: stats[3],
          webhook: stats[4],
        },
      },
    });
  } catch (error: any) {
    const statusCode = error.message === "Unauthorized" ? 401 : error.message === "Admin access required" ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status: statusCode });
  }
}

// PUT: Update lead status or notes
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { leadId, status, notes } = body;

    if (!leadId) {
      return NextResponse.json({ success: false, error: "Lead ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.inboundLead.update({
      where: { id: leadId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const statusCode = error.message === "Unauthorized" ? 401 : error.message === "Admin access required" ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status: statusCode });
  }
}

// DELETE: Delete junk lead
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("id");

    if (!leadId) {
      return NextResponse.json({ success: false, error: "Lead ID is required" }, { status: 400 });
    }

    await prisma.inboundLead.delete({
      where: { id: leadId },
    });

    return NextResponse.json({ success: true, message: "Lead deleted successfully" });
  } catch (error: any) {
    const statusCode = error.message === "Unauthorized" ? 401 : error.message === "Admin access required" ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status: statusCode });
  }
}
