"use server";

import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { createStandardizedLead } from "@/lib/crm/crmLeadService";
import { revalidatePath } from "next/cache";

export interface ParsedLeadRow {
  rowNumber: number;
  name: string;
  phone: string;
  email?: string | null;
  course?: string | null;
  batch?: string | null;
  tags?: string[];
  status?: string;
  notes?: string | null;
  isValid: boolean;
  validationError?: string;
  isDuplicate?: boolean;
}

export interface ParseResult {
  success: boolean;
  error?: string;
  totalRows: number;
  validRows: ParsedLeadRow[];
  invalidRows: ParsedLeadRow[];
  headers: string[];
}

/**
 * Parses an uploaded .xlsx, .xls, or .csv file and validates rows.
 */
export async function parseLeadsSpreadsheet(
  instituteId: string,
  formData: FormData
): Promise<ParseResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No file provided", totalRows: 0, validRows: [], invalidRows: [], headers: [] };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, error: "Empty spreadsheet", totalRows: 0, validRows: [], invalidRows: [], headers: [] };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (rawRows.length === 0) {
      return { success: false, error: "No data rows found in sheet", totalRows: 0, validRows: [], invalidRows: [], headers: [] };
    }

    const headers = Object.keys(rawRows[0] || {});

    // Existing phone numbers for duplicate detection
    const existingLeads = await prisma.instituteEnquiry.findMany({
      where: { instituteId },
      select: { phone: true },
    });
    const existingPhoneSet = new Set(
      existingLeads.map((l: any) => l.phone.replace(/[^\d]/g, "").slice(-10))
    );

    const validRows: ParsedLeadRow[] = [];
    const invalidRows: ParsedLeadRow[] = [];

    rawRows.forEach((row: any, index: any) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for header row

      // Column finder helper
      const findVal = (patterns: string[]) => {
        for (const [key, val] of Object.entries(row)) {
          const cleanKey = key.trim().toLowerCase();
          if (patterns.some((p) => cleanKey === p || cleanKey.includes(p))) {
            return String(val).trim();
          }
        }
        return "";
      };

      const name = findVal(["student name", "full name", "candidate name", "student", "name"]);
      const phoneRaw = findVal(["phone number", "mobile number", "whatsapp number", "contact", "mobile", "phone"]);
      const email = findVal(["email address", "student email", "mail", "email"]);
      const course = findVal(["course of interest", "target exam", "program", "course", "class", "stream"]);
      const batch = findVal(["batch timing", "batch name", "timing", "batch"]);
      const tagsRaw = findVal(["lead tags", "tags", "tag", "category"]);
      const statusRaw = findVal(["lead status", "status", "stage"]);
      const notes = findVal(["remarks", "remark", "notes", "note", "message", "query"]);

      const cleanPhone = phoneRaw.replace(/[^\d]/g, "");

      // Validation
      let isValid = true;
      let validationError = "";

      if (!name) {
        isValid = false;
        validationError = "Missing student name";
      } else if (!cleanPhone || cleanPhone.length < 10) {
        isValid = false;
        validationError = `Invalid phone number (${phoneRaw || "empty"})`;
      }

      const tenDigitPhone = cleanPhone.slice(-10);
      const isDuplicate = existingPhoneSet.has(tenDigitPhone);

      const parsedTags = tagsRaw
        ? tagsRaw
          .split(/[,;|]/)
          .map((t: any) => t.trim())
          .filter(Boolean)
        : [];

      // Normalize status
      let normalizedStatus = "NEW";
      const sUpper = statusRaw.toUpperCase();
      if (sUpper.includes("MESSAGE")) normalizedStatus = "MESSAGED";
      else if (sUpper.includes("CALL") && !sUpper.includes("NOT")) normalizedStatus = "CALLED";
      else if (sUpper.includes("DNP") || sUpper.includes("PICK")) normalizedStatus = "DNP";
      else if (sUpper.includes("LATER") || sUpper.includes("FOLLOW")) normalizedStatus = "CONTACT_LATER";
      else if (sUpper.includes("JUNK") || sUpper.includes("INVALID")) normalizedStatus = "JUNK";
      else if (sUpper.includes("CONVERT") || sUpper.includes("ADMISSION")) normalizedStatus = "CONVERTED";

      const leadRow: ParsedLeadRow = {
        rowNumber,
        name: name || "Unknown",
        phone: cleanPhone,
        email: email || null,
        course: course || null,
        batch: batch || null,
        tags: parsedTags,
        status: normalizedStatus,
        notes: notes || null,
        isValid,
        validationError: validationError || undefined,
        isDuplicate,
      };

      if (isValid) {
        validRows.push(leadRow);
      } else {
        invalidRows.push(leadRow);
      }
    });

    return {
      success: true,
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      headers,
    };
  } catch (error: any) {
    console.error("parseLeadsSpreadsheet error:", error);
    return {
      success: false,
      error: error.message || "Failed to parse spreadsheet",
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      headers: [],
    };
  }
}

export interface CommitImportInput {
  instituteId: string;
  leads: ParsedLeadRow[];
  skipDuplicates: boolean;
  assignedIsmId?: string | null;
  defaultCourse?: string | null;
  defaultBatch?: string | null;
  additionalTags?: string[];
  sendWelcomeEmail?: boolean;
}

/**
 * Commits parsed leads to the database in batch
 */
export async function commitLeadImport(input: CommitImportInput) {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const {
    instituteId,
    leads,
    skipDuplicates = true,
    assignedIsmId,
    defaultCourse,
    defaultBatch,
    additionalTags = [],
    sendWelcomeEmail = false,
  } = input;

  // Authorization check
  const isManager = await prisma.instituteManager.findUnique({
    where: {
      userId_instituteId: { userId: session.user.id, instituteId },
    },
  });

  if (session.user.role !== "ADMIN" && !isManager) {
    return { success: false, error: "Not authorized to manage leads for this institute" };
  }

  let importedCount = 0;
  let skippedDuplicateCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    if (!lead.isValid) {
      errorCount++;
      continue;
    }

    if (lead.isDuplicate && skipDuplicates) {
      skippedDuplicateCount++;
      continue;
    }

    try {
      const mergedTags = Array.from(
        new Set([...(lead.tags || []), ...additionalTags])
      );

      await createStandardizedLead({
        instituteId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        course: lead.course || defaultCourse || null,
        batch: lead.batch || defaultBatch || null,
        source: "EXCEL_IMPORT",
        message: lead.notes || "Imported from Excel/CSV spreadsheet",
        status: lead.status || "NEW",
        tags: mergedTags,
        assignedIsmId: assignedIsmId || null,
        creatorUserId: session.user.id,
        creatorRole: "MANAGER",
        creatorName: session.user.name || "Institute Manager",
        skipAutoEmail: !sendWelcomeEmail,
      });

      importedCount++;
    } catch (e) {
      console.error(`Error importing row ${lead.rowNumber}:`, e);
      errorCount++;
    }
  }

  revalidatePath(`/manager/${instituteId}/leads`);
  revalidatePath(`/manager/${instituteId}/sales-team`);

  return {
    success: true,
    importedCount,
    skippedDuplicateCount,
    errorCount,
    message: `Successfully imported ${importedCount} leads${skippedDuplicateCount > 0 ? ` (${skippedDuplicateCount} duplicates skipped)` : ""
      }${errorCount > 0 ? ` (${errorCount} errors)` : ""}`,
  };
}

/**
 * Generates sample CSV string for institutes to download as reference
 */
export async function getSampleCsvTemplate(): Promise<string> {
  const headers = [
    "Student Name",
    "Phone Number",
    "Email",
    "Course",
    "Batch",
    "Tags",
    "Status",
    "Notes",
  ];

  const sampleRows = [
    [
      "Rahul Sharma",
      "9876543210",
      "rahul.sharma@example.com",
      "JEE Main & Advanced",
      "Evening Batch (5 PM - 8 PM)",
      "Hot Lead, Scholarship",
      "New",
      "Looking for 2-year classroom program",
    ],
    [
      "Priya Verma",
      "9812345678",
      "priya.v@example.com",
      "NEET Medical",
      "Morning Batch (8 AM - 12 PM)",
      "Parent Interested",
      "Messaged",
      "Parent requested fee details on WhatsApp",
    ],
    [
      "Aman Singh",
      "9988776655",
      "aman.singh@example.com",
      "Class 10 CBSE",
      "Weekend Batch",
      "Referral",
      "Contact Later",
      "Call back on Sunday 4 PM",
    ],
    [
      "Riya Gupta",
      "9123456780",
      "riya.g@example.com",
      "Foundation Class 9",
      "Regular Weekday",
      "Scholarship",
      "Converted",
      "Paid registration amount ₹5000",
    ],
  ];

  const csvLines = [
    headers.join(","),
    ...sampleRows.map((r: any) => r.map((field: any) => `"${field.replace(/"/g, '""')}"`).join(",")),
  ];

  return "\uFEFF" + csvLines.join("\r\n");
}
