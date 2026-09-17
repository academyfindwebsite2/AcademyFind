import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";
import { notifyUser } from "@/lib/notifications/notify";
import type { NotificationType } from "@/app/generated/prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { instituteId } = await params;
    const userId = session.user.id;

    const isAssigned = await prisma.instituteSalesManagerAssignment.findUnique({
      where: { userId_instituteId: { userId, instituteId } },
    });
    const isManager = await prisma.instituteManager.findUnique({
      where: { userId_instituteId: { userId, instituteId } },
    });
    if (!isAssigned?.isActive && !isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const whereClause: any = { instituteId };
    if (!isManager && session.user.role !== "ADMIN") {
      whereClause.ismId = userId;
    }

    const admissions = await prisma.admissionRecord.findMany({
      where: whereClause,
      include: {
        enquiry: {
          select: { id: true, name: true, phone: true, email: true, course: true },
        },
        ism: {
          select: { id: true, name: true, email: true },
        },
        installments: {
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalAdmissions = admissions.length;
    const totalFeeValue = admissions.reduce((sum: number, a: any) => sum + (a.totalFee || 0), 0);
    const totalFeeCollected = admissions.reduce((sum: number, a: any) => sum + (a.paidAmount || 0), 0);
    const pendingFeeValue = Math.max(0, totalFeeValue - totalFeeCollected);

    return NextResponse.json({
      success: true,
      data: {
        admissions,
        summary: {
          totalAdmissions,
          totalFeeValue,
          totalFeeCollected,
          pendingFeeValue,
        },
      },
    });
  } catch (error: any) {
    console.error("Mobile ISM Admissions GET Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
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
    const body = await request.json();
    const { installmentId } = body;

    if (!installmentId) {
      return NextResponse.json({ success: false, error: "installmentId is required" }, { status: 400 });
    }

    const installment = await prisma.feeInstallment.findUnique({
      where: { id: installmentId },
      include: { admission: true },
    });

    if (!installment || installment.admission.instituteId !== instituteId) {
      return NextResponse.json({ success: false, error: "Installment not found" }, { status: 404 });
    }

    await prisma.feeInstallment.update({
      where: { id: installmentId },
      data: { status: "PAID", paidDate: new Date() },
    });

    // Recalculate paidAmount
    const allInstallments = await prisma.feeInstallment.findMany({
      where: { admissionId: installment.admissionId },
    });
    const paidAmount = allInstallments
      .filter((i: any) => i.status === "PAID" || i.id === installmentId)
      .reduce((sum: number, i: any) => sum + i.amount, 0);

    const feeStatus = paidAmount >= installment.admission.totalFee ? "PAID" : "PARTIAL";

    await prisma.admissionRecord.update({
      where: { id: installment.admissionId },
      data: { paidAmount, feeStatus },
    });

    // Notify Managers
    try {
      const managers = await prisma.instituteManager.findMany({
        where: { instituteId },
        select: { userId: true },
      });
      for (const m of managers) {
        if (m.userId === session.user.id) continue;
        await notifyUser(
          m.userId,
          "SYSTEM" as NotificationType,
          "💰 Fee Installment Collected!",
          `${session.user.name || "Sales Manager"} marked installment of ₹${installment.amount.toLocaleString("en-IN")} as PAID for "${installment.admission.studentName}".`,
          installment.admission.enquiryId
        );
      }
    } catch (err) {
      console.warn("Failed to notify managers about installment:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Installment marked as PAID",
      data: { paidAmount, feeStatus },
    });
  } catch (error: any) {
    console.error("Mobile ISM Admissions POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
