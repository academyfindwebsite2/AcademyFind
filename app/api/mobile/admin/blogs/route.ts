import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { creditWallet } from '@/lib/wallet/credit';
import { syncBlogPostToMeili, deleteBlogPostFromMeili } from '@/lib/User/user/blog/meilisync';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true },
  });
  if (user?.role !== 'ADMIN') return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim() || '';
    const status = searchParams.get('status')?.trim();
    const brandId = searchParams.get('brandId')?.trim();
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 40));

    const where: any = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
        { authorProfile: { displayName: { contains: query, mode: 'insensitive' } } },
        { authorProfile: { user: { name: { contains: query, mode: 'insensitive' } } } },
        { brand: { name: { contains: query, mode: 'insensitive' } } },
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (brandId && brandId !== 'ALL') {
      where.brandId = brandId;
    }

    const [posts, total, groupedStatuses, brands] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          status: true,
          visibility: true,
          isFeatured: true,
          isPinned: true,
          viewCount: true,
          commentCount: true,
          rejectionReason: true,
          updatedAt: true,
          publishedAt: true,
          createdAt: true,
          brand: {
            select: { id: true, name: true, avatarUrl: true },
          },
          authorProfile: {
            select: {
              id: true,
              displayName: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
          relatedInstitute: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.blogPost.count({ where }),
      prisma.blogPost.groupBy({ by: ['status'], _count: true }),
      prisma.blogBrand.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

    const counts: Record<string, number> = {
      ALL: await prisma.blogPost.count(),
      PENDING_REVIEW: 0,
      CONTACTED: 0,
      PUBLISHED: 0,
      DRAFT: 0,
      REJECTED: 0,
      ARCHIVED: 0,
      SCHEDULED: 0,
    };

    groupedStatuses.forEach((item: any) => {
      counts[item.status] = item._count;
    });

    return NextResponse.json({
      success: true,
      data: {
        posts,
        total,
        counts,
        brands,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin blogs:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, isFeatured, isPinned, rejectionReason } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing blog ID' }, { status: 400 });
    }

    const existing = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        authorProfile: {
          select: { userId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Blog post not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (status) {
      updateData.status = status;
      updateData.lastEditedById = admin.id;

      if (status === 'PUBLISHED') {
        updateData.reviewedById = admin.id;
        updateData.reviewedAt = new Date();
        updateData.publishedById = admin.id;
        if (!existing.publishedAt) {
          updateData.publishedAt = new Date();
        }
      } else if (status === 'REJECTED') {
        updateData.reviewedById = admin.id;
        updateData.reviewedAt = new Date();
        if (rejectionReason !== undefined) {
          updateData.rejectionReason = rejectionReason;
        }
      } else if (status === 'CONTACTED') {
        updateData.reviewedById = admin.id;
        updateData.reviewedAt = new Date();
      }
    }

    if (isFeatured !== undefined) {
      updateData.isFeatured = Boolean(isFeatured);
    }

    if (isPinned !== undefined) {
      updateData.isPinned = Boolean(isPinned);
    }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        slug: true,
        status: true,
        isFeatured: true,
        isPinned: true,
        rejectionReason: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    // Handle side-effects: Meilisearch sync & wallet credits
    if (status === 'PUBLISHED') {
      try {
        await syncBlogPostToMeili(id);
      } catch (err) {
        console.error('Meilisearch sync error:', err);
      }

      // Reward 5 AFC if post is newly published
      if (!existing.publishedAt && existing.authorProfile?.userId) {
        try {
          await creditWallet(
            existing.authorProfile.userId,
            5,
            'BLOG_POST',
            'Blog post published',
            id
          );
        } catch (err) {
          console.error('Credit wallet error:', err);
        }
      }
    } else if (status === 'ARCHIVED' || status === 'REJECTED' || status === 'DRAFT') {
      try {
        await deleteBlogPostFromMeili(id);
      } catch (err) {
        console.error('Meilisearch delete error:', err);
      }
    }

    try {
      revalidatePath('/blog');
      revalidatePath(`/blog/${existing.slug}`);
      revalidatePath('/af-ass-manage/blog');
    } catch {}

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating admin blog:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing blog ID' }, { status: 400 });
    }

    const post = await prisma.blogPost.findUnique({
      where: { id },
      select: { slug: true },
    });

    await prisma.blogPost.delete({ where: { id } });

    try {
      await deleteBlogPostFromMeili(id);
    } catch (err) {
      console.error('Meilisearch delete error:', err);
    }

    try {
      revalidatePath('/blog');
      if (post?.slug) revalidatePath(`/blog/${post.slug}`);
      revalidatePath('/af-ass-manage/blog');
    } catch {}

    return NextResponse.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting admin blog:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}
