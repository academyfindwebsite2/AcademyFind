import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (session.user.role !== 'SALES_MANAGER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || session.user.id;
    const search = searchParams.get('search') || '';
    const cityId = searchParams.get('cityId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const subscriptionPlan = searchParams.get('subscriptionPlan') || '';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'name_asc';
    const assignment = searchParams.get('assignment') || 'all';

    // Get the sales manager's assigned categories
    const assignedCategories = await prisma.salesCategoryAssignment.findMany({
      where: { salesManagerId: id },
      select: { categoryId: true, category: { select: { id: true, name: true } } },
    });

    const assignedCategoryIds = assignedCategories.map((c: any) => c.categoryId);

    const whereCondition: any = {};

    if (search) {
      whereCondition.name = { contains: search, mode: "insensitive" };
    }

    if (cityId) {
      whereCondition.cityId = cityId;
    }

    if (categoryId) {
      whereCondition.categories = {
        some: { categoryId }
      };
    } else if (assignedCategoryIds.length > 0) {
      whereCondition.categories = {
        some: { categoryId: { in: assignedCategoryIds } }
      };
    }

    if (status === 'active') whereCondition.isActive = true;
    else if (status === 'inactive') whereCondition.isActive = false;
    else if (status === 'published') whereCondition.isPublished = true;
    else if (status === 'hidden') whereCondition.isPublished = false;

    if (subscriptionPlan) {
      whereCondition.subscriptionPlan = subscriptionPlan;
    }

    if (assignment === 'my_assignments') {
      whereCondition.salesAssignments = { salesManagerId: id };
    } else if (assignment === 'unassigned') {
      whereCondition.salesAssignments = null;
    } else if (assignment === 'other_assignments') {
      whereCondition.salesAssignments = { salesManagerId: { not: id } };
    }

    let orderByCondition: any = { name: "asc" };
    if (sortBy === 'newest') orderByCondition = { createdAt: "desc" };
    else if (sortBy === 'oldest') orderByCondition = { createdAt: "asc" };
    else if (sortBy === 'views') orderByCondition = { viewCount: "desc" };

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(10, Number(searchParams.get('limit')) || 20));
    const includeMeta = searchParams.get('includeMeta') !== 'false' && page === 1;

    const queries: Promise<any>[] = [
      prisma.institute.count({ where: whereCondition }),
      prisma.institute.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          email: true,
          address: true,
          subscriptionPlan: true,
          isActive: true,
          isPublished: true,
          city: { select: { name: true } },
          categories: {
            include: { category: { select: { id: true, name: true } } },
            take: 2,
          },
          salesAssignments: {
            select: {
              id: true,
              salesManagerId: true,
              contactStatus: true,
              salesManager: { select: { name: true } }
            }
          }
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: orderByCondition,
      }),
    ];

    if (includeMeta) {
      queries.push(prisma.city.findMany({ orderBy: { name: "asc" } }));
      queries.push(prisma.category.findMany({ orderBy: { name: "asc" } }));
    }

    const results = await Promise.all(queries);
    const total = results[0];
    const institutes = results[1];
    const cities = includeMeta ? results[2] : [];
    const allCategories = includeMeta ? results[3] : [];
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ 
      success: true, 
      data: {
        institutes,
        total,
        page,
        totalPages,
        hasMore: page < totalPages,
        assignedCategories,
        cities,
        categories: allCategories,
      } 
    });
  } catch (error: any) {
    console.error("Sales Institutes API Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
