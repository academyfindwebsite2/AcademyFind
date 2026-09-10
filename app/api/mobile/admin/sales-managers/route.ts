import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Return single sales manager with active assignments
      const manager = await prisma.user.findUnique({
        where: { id, role: 'SALES_MANAGER' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          salesAssignments: {
            select: {
              id: true,
              instituteId: true,
              contactStatus: true,
              interest: true,
              remark: true,
              deadline: true,
              contactedAt: true,
              onboardedAt: true,
              createdAt: true,
              institute: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  address: true,
                  city: { select: { name: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          salesAreaAssignments: {
            select: {
              id: true,
              areaName: true,
              latitude: true,
              longitude: true,
              radiusKm: true,
              deadline: true,
              createdAt: true,
              _count: { select: { institutes: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          salesCategoryAssignments: {
            select: {
              id: true,
              categoryId: true,
              deadline: true,
              createdAt: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              salesAssignments: true,
              salesAreaAssignments: true,
              salesCategoryAssignments: true,
            },
          },
        },
      });

      if (!manager) {
        return NextResponse.json({ success: false, error: 'Sales Manager not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: manager });
    }

    // List all managers with assignment counts
    const managers = await prisma.user.findMany({
      where: { role: 'SALES_MANAGER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            salesAssignments: true,
            salesAreaAssignments: true,
            salesCategoryAssignments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: managers });
  } catch (error: any) {
    console.error('Mobile Admin Sales Managers Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
