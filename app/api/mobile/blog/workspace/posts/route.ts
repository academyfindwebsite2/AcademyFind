import { NextRequest, NextResponse } from "next/server";
import { saveBlogPost } from "@/lib/User/user/blog/saveblogpost";
import { getSession } from "@/lib/auth/getSession";
import { getEditBlogData } from "@/lib/User/user/blog/geteditblogdata";
import { deleteBlogPost } from "@/lib/User/user/blog/deleteblogpost";
import { v2 as cloudinary } from "cloudinary";
import type { BlogEditorSaveInput } from "@/components/blog/editor/types";
import { prisma } from "@/lib/prisma";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const sessionObj = await prisma.session.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
    });
    if (sessionObj) return sessionObj.userId;
  }
  const session = await getSession();
  return session?.user?.id || null;
}

async function uploadImageToCloudinary(file: File, folderName: string, idPrefix: string) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;
  const uploadResult = await cloudinary.uploader.upload(dataUri, {
    folder: `academyfind/${folderName}`,
    public_id: `${idPrefix}-${Date.now()}`,
    overwrite: true,
    format: "webp",
  });
  return uploadResult.secure_url;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please login first' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Post ID is required' }, { status: 400 });
    }

    const post = await getEditBlogData(id, userId);
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: post });
  } catch (error: any) {
    console.error('Get Edit Blog Post Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please login first' }, { status: 401 });
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const excerpt = formData.get('excerpt') as string;
    const contentHtml = formData.get('contentHtml') as string;
    const categoryId = formData.get('categoryId') as string;
    const imageFile = formData.get('coverImage') as File;
    const tagNamesStr = formData.get('tagNames') as string;
    const intent = (formData.get('intent') as string) || "draft";

    const firstBrand = await prisma.blogBrand.findFirst();
    const brandId = (formData.get('brandId') as string) || firstBrand?.id || "";

    if (!title || !contentHtml || !categoryId) {
      return NextResponse.json({ success: false, error: 'Title, content and category are required' }, { status: 400 });
    }

    let coverImageUrl = (formData.get('existingCoverImage') as string) || "";
    if (imageFile && imageFile.size > 0) {
      coverImageUrl = await uploadImageToCloudinary(imageFile, "blog", "cover");
    }

    const tagNames = tagNamesStr ? tagNamesStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const generatedSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const relatedInstituteId = (formData.get('relatedInstituteId') || formData.get('instituteId')) as string | null;

    const input: BlogEditorSaveInput = {
      title,
      slug: generatedSlug,
      excerpt: excerpt || title.substring(0, 150),
      contentHtml,
      coverImage: coverImageUrl,
      categoryId,
      brandId,
      tagNames,
      relatedInstituteId: relatedInstituteId || undefined,
      metaTitle: title.substring(0, 70),
      metaDescription: excerpt ? excerpt.substring(0, 180) : title.substring(0, 180),
      focusKeyword: "",
      faqs: [],
      intent: intent as "draft" | "publish",
    };

    const result = await saveBlogPost(input, userId);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ success: false, error: result.error || "Failed to save post" }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Create Blog Post Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please login first' }, { status: 401 });
    }

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const excerpt = formData.get('excerpt') as string;
    const contentHtml = formData.get('contentHtml') as string;
    const categoryId = formData.get('categoryId') as string;
    const imageFile = formData.get('coverImage') as File;
    const tagNamesStr = formData.get('tagNames') as string;
    const intent = (formData.get('intent') as string) || "draft";

    if (!id || !title || !contentHtml || !categoryId) {
      return NextResponse.json({ success: false, error: 'ID, title, content and category are required' }, { status: 400 });
    }

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    let coverImageUrl = (formData.get('existingCoverImage') as string) || existing.coverImage || "";
    if (imageFile && imageFile.size > 0) {
      coverImageUrl = await uploadImageToCloudinary(imageFile, "blog", "cover");
    }

    const tagNames = tagNamesStr ? tagNamesStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const relatedInstituteId = (formData.get('relatedInstituteId') || formData.get('instituteId')) as string | null;

    const input: BlogEditorSaveInput = {
      id,
      title,
      slug: existing.slug,
      excerpt: excerpt || title.substring(0, 150),
      contentHtml,
      coverImage: coverImageUrl,
      categoryId,
      brandId: existing.brandId || "",
      tagNames,
      relatedInstituteId: relatedInstituteId !== null ? (relatedInstituteId || undefined) : (existing.relatedInstituteId || undefined),
      metaTitle: existing.metaTitle || title.substring(0, 70),
      metaDescription: existing.metaDescription || excerpt?.substring(0, 180) || title.substring(0, 180),
      focusKeyword: existing.focusKeyword || "",
      faqs: [],
      intent: intent as "draft" | "publish",
    };

    const result = await saveBlogPost(input, userId);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ success: false, error: result.error || "Failed to save post" }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Update Blog Post Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please login first' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Post ID is required' }, { status: 400 });
    }

    const result = await deleteBlogPost(id);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ success: false, error: result.error || "Failed to delete post" }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Delete Blog Post Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
