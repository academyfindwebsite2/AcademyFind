import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/getSession";

// GET /api/ism/search-users?q=query&instituteId=xxx
// Searches users by name, username, or email for ISM assignment
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const instituteId = searchParams.get("instituteId") || "";

  if (q.length < 2) return NextResponse.json({ users: [] });

  // Get already-assigned ISM user IDs for this institute to mark them
  const alreadyAssigned = await prisma.instituteSalesManagerAssignment.findMany({
    where: { instituteId, isActive: true },
    select: { userId: true },
  });
  const assignedIds = new Set(alreadyAssigned.map((a: any) => a.userId));

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
    },
    take: 8,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    users: users.map((u: any) => ({
      ...u,
      alreadyAssigned: assignedIds.has(u.id),
    })),
  });
}
