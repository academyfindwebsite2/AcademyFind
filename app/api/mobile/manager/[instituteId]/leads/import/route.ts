import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/prisma";
import { parseLeadsSpreadsheet, commitLeadImport, getSampleCsvTemplate } from "@/lib/crm/leadImportActions";

export async function GET() {
  const csvContent = await getSampleCsvTemplate();
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="academyfind_sample_leads.csv"',
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId } = await params;

    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId: session.user.id, instituteId } },
    });
    if (!isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";

    // 1. Multipart Form Data (File Upload for parsing & preview or direct commit)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = formData.get("action") as string;

      // Also ensure "file" is extracted even if appended as "leadFile"
      if (!formData.get("file") && formData.get("leadFile")) {
        formData.set("file", formData.get("leadFile") as any);
      }

      // Parse spreadsheet
      const parseResult = await parseLeadsSpreadsheet(instituteId, formData);
      if (!parseResult.success) {
        return NextResponse.json({ success: false, error: parseResult.error }, { status: 400 });
      }

      // If action is not explicitly "preview_only", commit immediately for mobile convenience
      if (action !== "preview_only") {
        const skipDuplicates = formData.get("skipDuplicates") !== "false";
        const assignedIsmId = (formData.get("assignedIsmId") as string) || null;
        const defaultCourse = (formData.get("defaultCourse") as string) || null;

        const commitResult = await commitLeadImport({
          instituteId,
          leads: parseResult.validRows,
          skipDuplicates,
          assignedIsmId,
          defaultCourse,
        });

        return NextResponse.json(commitResult);
      }

      return NextResponse.json({
        success: true,
        data: parseResult,
      });
    }

    // 2. JSON Payload (Commit parsed rows)
    const body = await request.json();
    const {
      leads,
      skipDuplicates = true,
      assignedIsmId,
      defaultCourse,
      defaultBatch,
      additionalTags = [],
    } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ success: false, error: "No leads data provided" }, { status: 400 });
    }

    const commitResult = await commitLeadImport({
      instituteId,
      leads,
      skipDuplicates,
      assignedIsmId,
      defaultCourse,
      defaultBatch,
      additionalTags,
    });

    return NextResponse.json(commitResult);
  } catch (error: any) {
    console.error("Mobile Manager Lead Import Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
