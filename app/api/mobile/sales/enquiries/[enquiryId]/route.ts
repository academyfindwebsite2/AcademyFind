import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, notifyUser } from "@/lib/notifications/notify";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ enquiryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { enquiryId } = await params;

    const enquiry = await prisma.instituteEnquiry.findUnique({
      where: { id: enquiryId },
      include: {
        institute: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            email: true,
            address: true,
            latitude: true,
            longitude: true,
            city: { select: { name: true } },
            categories: {
              include: { category: { select: { id: true, name: true } } },
              take: 2,
            },
          },
        },
        assignedSalesManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!enquiry) {
      return NextResponse.json({ success: false, error: "Enquiry not found" }, { status: 404 });
    }

    // Security check: Only Admin or the assigned Sales Manager can view
    if (
      session.user.role !== "ADMIN" &&
      enquiry.assignedSalesManagerId !== session.user.id
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not assigned to this enquiry" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, enquiry });
  } catch (error: any) {
    console.error("Error fetching mobile enquiry detail:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch enquiry detail" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ enquiryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { enquiryId } = await params;
    const body = await req.json();
    const { status, userContactStatus, salesManagerNote, commentContent } = body;

    const enquiry = await prisma.instituteEnquiry.findUnique({
      where: { id: enquiryId },
      include: { institute: { select: { name: true } } },
    });

    if (!enquiry) {
      return NextResponse.json({ success: false, error: "Enquiry not found" }, { status: 404 });
    }

    // Security check: Only Admin or assigned Sales Manager
    if (
      session.user.role !== "ADMIN" &&
      enquiry.assignedSalesManagerId !== session.user.id
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not assigned to this enquiry" },
        { status: 403 }
      );
    }

    const userRole: string = session.user.role || "SALES_MANAGER";
    const userName: string = session.user.name || (userRole === "ADMIN" ? "Admin" : "Sales Manager");

    const updateData: any = {
      lastUpdatedByRole: userRole,
      lastUpdatedByName: userName,
    };

    // 1. Institute Status change
    if (status && status !== enquiry.status) {
      updateData.status = status;
      await prisma.enquiryStatusHistory.create({
        data: {
          enquiryId,
          oldStatus: enquiry.status,
          newStatus: status,
          statusType: "INSTITUTE",
          updatedByRole: userRole,
          updatedByName: userName,
        },
      });

      if (userRole === "SALES_MANAGER") {
        await notifyAdmins(
          "CALLBACK",
          "⚡ Enquiry Status Updated by Sales Manager",
          `${userName} updated status of enquiry for ${enquiry.institute?.name || "Institute"} to ${status}.`,
          `/af-ass-manage/instituteCallbacks/${enquiryId}`,
          enquiryId,
        );
      }
    }

    // 2. Student Contact Status change
    if (userContactStatus && userContactStatus !== enquiry.userContactStatus) {
      updateData.userContactStatus = userContactStatus;
      await prisma.enquiryStatusHistory.create({
        data: {
          enquiryId,
          oldStatus: enquiry.userContactStatus,
          newStatus: userContactStatus,
          statusType: "STUDENT",
          updatedByRole: userRole,
          updatedByName: userName,
        },
      });

      if (userRole === "SALES_MANAGER") {
        await notifyAdmins(
          "CALLBACK",
          "⚡ Student Contact Status Updated by Sales Manager",
          `${userName} updated student status of enquiry for ${enquiry.institute?.name || "Institute"} to ${userContactStatus}.`,
          `/af-ass-manage/instituteCallbacks/${enquiryId}`,
          enquiryId,
        );
      }
    }

    // 3. Sales Manager Note update
    if (typeof salesManagerNote === "string" && salesManagerNote !== enquiry.salesManagerNote) {
      updateData.salesManagerNote = salesManagerNote.trim();
    }

    // 4. Add Comment
    if (commentContent && commentContent.trim()) {
      await prisma.enquiryComment.create({
        data: {
          enquiryId,
          content: commentContent.trim(),
          authorRole: userRole,
          authorName: userName,
          authorId: session.user.id,
        },
      });

      if (userRole === "SALES_MANAGER") {
        await notifyAdmins(
          "CALLBACK",
          "📝 Note added by Sales Manager",
          `${userName} added note: "${commentContent.trim().slice(0, 50)}..." on enquiry for ${enquiry.institute?.name || "the institute"}.`,
          `/af-ass-manage/instituteCallbacks/${enquiryId}`,
          enquiryId,
        );
      }
    }

    const updatedEnquiry = await prisma.instituteEnquiry.update({
      where: { id: enquiryId },
      data: updateData,
      include: {
        institute: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            email: true,
            address: true,
            latitude: true,
            longitude: true,
            city: { select: { name: true } },
            categories: {
              include: { category: { select: { id: true, name: true } } },
              take: 2,
            },
          },
        },
        assignedSalesManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ success: true, enquiry: updatedEnquiry });
  } catch (error: any) {
    console.error("Error updating mobile enquiry detail:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update enquiry detail" },
      { status: 500 }
    );
  }
}
