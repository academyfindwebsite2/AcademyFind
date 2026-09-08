import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const instituteId = searchParams.get('instituteId');
    if (!instituteId) return NextResponse.json({ success: false, error: 'Institute ID missing' }, { status: 400 });

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, name: true, subscriptionPlan: true }
    });
    if (!institute) return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });

    const isPremiumOrUltra = institute.subscriptionPlan === 'PREMIUM' || institute.subscriptionPlan === 'ULTRA';
    if (!isPremiumOrUltra) {
      return NextResponse.json({
        success: true,
        data: {
          isLocked: true,
          plan: institute.subscriptionPlan,
          instituteName: institute.name,
          blogs: [],
          stats: { total: 0, published: 0, pending: 0, rejected: 0, totalViews: 0 },
        }
      });
    }

    const blogs = await prisma.blogPost.findMany({
      where: { relatedInstituteId: instituteId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        coverImage: true,
        rejectionReason: true,
        viewCount: true,
        excerpt: true,
        contentHtml: true,
        contentMarkdown: true,
      },
    });

    const publishedCount = blogs.filter((b: any) => b.status === 'PUBLISHED').length;
    const pendingCount = blogs.filter((b: any) => b.status === 'PENDING_REVIEW').length;
    const rejectedCount = blogs.filter((b: any) => b.status === 'REJECTED').length;
    const totalViews = blogs.reduce((acc: any, b: any) => acc + (b.viewCount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        isLocked: false,
        plan: institute.subscriptionPlan,
        instituteName: institute.name,
        stats: {
          total: blogs.length,
          published: publishedCount,
          pending: pendingCount,
          rejected: rejectedCount,
          totalViews,
        },
        blogs,
      }
    });
  } catch (error: any) {
    console.error('Manager Blogs API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { instituteId, title, content, coverImage, excerpt } = body;

    if (!instituteId || !title?.trim() || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'Institute ID, Title, and Content are required' }, { status: 400 });
    }

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId }
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { subscriptionPlan: true }
    });
    if (institute?.subscriptionPlan !== 'PREMIUM' && institute?.subscriptionPlan !== 'ULTRA') {
      return NextResponse.json({ success: false, error: 'Article publishing requires Premium or Ultra subscription' }, { status: 403 });
    }

    // Auto find or create BlogAuthorProfile for the user
    let author = await prisma.blogAuthorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });

    if (!author) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      const emailPrefix = user?.email ? user.email.split('@')[0] : 'author';
      const baseUsername = emailPrefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'author';
      let username = baseUsername;
      let counter = 0;
      while (await prisma.blogAuthorProfile.findUnique({ where: { username } })) {
        counter++;
        username = `${baseUsername}${counter}`;
      }

      author = await prisma.blogAuthorProfile.create({
        data: {
          userId: session.user.id,
          displayName: user?.name || 'Academy Manager',
          username,
          avatarUrl: user?.image || null,
        },
        select: { id: true }
      });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString(36);

    const blog = await prisma.blogPost.create({
      data: {
        title: title.trim(),
        slug,
        excerpt: excerpt?.trim() || title.trim(),
        contentHtml: content.trim(),
        contentMarkdown: content.trim(),
        coverImage: coverImage?.trim() || null,
        relatedInstituteId: instituteId,
        authorProfileId: author.id,
        publishedById: session.user.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      }
    });

    return NextResponse.json({ success: true, data: blog });
  } catch (error: any) {
    console.error('Manager Blogs POST Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { blogId, title, content, coverImage, excerpt } = body;

    if (!blogId || !title?.trim()) {
      return NextResponse.json({ success: false, error: 'Blog ID and Title are required' }, { status: 400 });
    }

    const existingBlog = await prisma.blogPost.findUnique({
      where: { id: blogId },
      select: { id: true, relatedInstituteId: true }
    });
    if (!existingBlog) {
      return NextResponse.json({ success: false, error: 'Blog not found' }, { status: 404 });
    }

    if (existingBlog.relatedInstituteId) {
      const isManager = await prisma.instituteManager.findFirst({
        where: { userId: session.user.id, instituteId: existingBlog.relatedInstituteId }
      });
      if (!isManager && session.user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const updatedBlog = await prisma.blogPost.update({
      where: { id: blogId },
      data: {
        title: title.trim(),
        excerpt: excerpt?.trim() || undefined,
        ...(content ? { contentHtml: content.trim(), contentMarkdown: content.trim() } : {}),
        coverImage: coverImage !== undefined ? (coverImage.trim() || null) : undefined,
      }
    });

    return NextResponse.json({ success: true, data: updatedBlog });
  } catch (error: any) {
    console.error('Manager Blogs PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const blogId = searchParams.get('id') || searchParams.get('blogId');

    if (!blogId) {
      return NextResponse.json({ success: false, error: 'Blog ID is required' }, { status: 400 });
    }

    const blog = await prisma.blogPost.findUnique({
      where: { id: blogId },
      select: { id: true, relatedInstituteId: true }
    });
    if (!blog) {
      return NextResponse.json({ success: false, error: 'Blog not found' }, { status: 404 });
    }

    if (blog.relatedInstituteId) {
      const isManager = await prisma.instituteManager.findFirst({
        where: { userId: session.user.id, instituteId: blog.relatedInstituteId }
      });
      if (!isManager && session.user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    await prisma.blogPost.delete({ where: { id: blogId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Manager Blogs DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
