"use server";

import slugify from "slugify";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { BlogEditorSaveInput } from "@/components/blog/editor/types";
import { getCachedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { syncBlogPostToMeili } from "./meilisync";
import { calculateReadingTime } from "@/lib/utils";
import { creditWallet } from "@/lib/wallet/credit";
import { AF_COINS_EARN } from "@/lib/wallet/af-coins";
import { sendBlogSubmissionNotification } from "@/lib/notifications/blogNotifications";

const blogEditorSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(180),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(500),
  contentHtml: z.string().trim().min(1),
  coverImage: z.union([z.literal(""), z.url()]),
  categoryId: z.string(),
  brandId: z.string(),
  tagNames: z.array(z.string().trim().min(1).max(50)).max(20),
  metaTitle: z.string().trim().max(70),
  metaDescription: z.string().trim().max(180),
  focusKeyword: z.string().trim().max(200),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().min(1).max(2000),
      }),
    )
    .max(20),
  intent: z.enum(["draft", "publish"]),
  relatedInstituteId: z.string().optional(),
});

export type SaveBlogPostResult =
  | { success: true; id: string; slug: string }
  | { success: false; error: string };

export async function saveBlogPost(
  input: BlogEditorSaveInput,
  targetUserId?: string,
): Promise<SaveBlogPostResult> {
  try {
    return await persistBlogPost(input, targetUserId);
  } catch (error) {
    console.error("Unable to save blog post:", error);
    return {
      success: false,
      error: "The post could not be saved. Please try again.",
    };
  }
}

async function persistBlogPost(
  input: BlogEditorSaveInput,
  targetUserId?: string,
): Promise<SaveBlogPostResult> {
  const parsed = blogEditorSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the post details.",
    };
  }

  let userId = targetUserId;
  if (!userId) {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return { success: false, error: "Please sign in to save this post." };
    }
    userId = session.user.id;
  }

  let author = await prisma.blogAuthorProfile.findUnique({
    where: { userId },
    select: { id: true, displayName: true },
  });

  // Auto-onboard the author if profile doesn't exist
  if (!author) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      const emailPrefix = user.email ? user.email.split("@")[0] : "author";
      const baseUsername = emailPrefix.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      let username = baseUsername || "author";
      let isUnique = false;
      let counter = 0;

      while (!isUnique) {
        const potentialUsername = counter === 0 ? username : `${username}${counter}`;
        const check = await prisma.blogAuthorProfile.findUnique({
          where: { username: potentialUsername },
        });
        if (!check) {
          isUnique = true;
          username = potentialUsername;
        } else {
          counter++;
        }
      }

      author = await prisma.blogAuthorProfile.create({
        data: {
          userId: user.id,
          displayName: user.name || "Anonymous Author",
          username,
          avatarUrl: user.image || null,
        },
        select: { id: true, displayName: true },
      });
    } else {
      return { success: false, error: "An author profile is required." };
    }
  }

  const value = parsed.data;
  const existingSlug = await prisma.blogPost.findFirst({
    where: {
      slug: value.slug,
      ...(value.id ? { id: { not: value.id } } : {}),
    },
    select: { id: true },
  });

  if (existingSlug) {
    return { success: false, error: "This slug is already in use." };
  }

  let existingPost: any = null;
  if (value.id) {
    existingPost = await prisma.blogPost.findUnique({
      where: { id: value.id },
      select: { authorProfileId: true, publishedAt: true, status: true },
    });

    if (!existingPost || existingPost.authorProfileId !== author.id) {
      return { success: false, error: "You cannot edit this post." };
    }
  }

  const uniqueTagNames = [
    ...new Map(
      value.tagNames.map((name: string) => [name.toLocaleLowerCase(), name.trim()]),
    ).values(),
  ];

  const status = value.intent === "publish" ? "PENDING_REVIEW" : "DRAFT";
  
  // Fix: Do not set publishedAt immediately. Admin will set it when they approve the post.
  const publishedAt = existingPost?.publishedAt ?? null;

  const sharedData = {
    title: value.title,
    slug: value.slug,
    excerpt: value.excerpt || null,
    contentHtml: value.contentHtml,
    contentMarkdown: value.contentHtml,
    coverImage: value.coverImage || null,
    coverImageAlt: value.title,
    categoryId: value.categoryId || null,
    brandId: value.brandId || null,
    relatedInstituteId: value.relatedInstituteId || null,
    metaTitle: value.metaTitle || null,
    metaDescription: value.metaDescription || null,
    focusKeyword: value.focusKeyword || null,
    status,
    publishedAt,
    readingTime: calculateReadingTime(value.contentHtml),
    ...(value.intent === "publish" ? { submittedAt: new Date() } : {}),
  } as const;

  const post = await prisma.$transaction(async (tx) => {
    const tags = await Promise.all(
      uniqueTagNames.map((name: string) => {
        const slug = slugify(name, { lower: true, strict: true, trim: true });
        if (!slug) {
          throw new Error(`Invalid tag: ${name}`);
        }

        return tx.blogTag.upsert({
          where: { slug },
          create: { name, slug },
          update: {},
          select: { id: true },
        });
      }),
    );

    let savedPost;
    if (value.id) {
      savedPost = await tx.blogPost.update({
        where: { id: value.id },
        data: {
          ...sharedData,
          tags: {
            deleteMany: {},
            create: tags.map((tag: { id: string }) => ({ tagId: tag.id })),
          },
          faqs: {
            deleteMany: {},
            create: value.faqs.map((faq: { question: string; answer: string }, order: number) => ({ ...faq, order })),
          },
        },
        select: { id: true, slug: true },
      });
    } else {
      savedPost = await tx.blogPost.create({
        data: {
          ...sharedData,
          authorProfileId: author.id,
          tags: {
            create: tags.map((tag: { id: string }) => ({ tagId: tag.id })),
          },
          faqs: {
            create: value.faqs.map((faq: { question: string; answer: string }, order: number) => ({ ...faq, order })),
          },
        },
        select: { id: true, slug: true },
      });
    }

    if (value.intent === "publish" && existingPost?.status !== "PENDING_REVIEW" && existingPost?.status !== "PUBLISHED") {
      await tx.adminNotification.create({
        data: {
          type: "BLOG_REVIEW",
          title: "New Blog Pending Review",
          message: `${author.displayName} has submitted a new blog post "${value.title}" for review.`,
          actionUrl: `/af-ass-manage/blog/edit/${savedPost.id}`,
        }
      });
      // Award coins for writing a blog
      if (!value.id) {
         // Create a background or separate await if needed, but doing it inside transaction is also fine if creditWallet supports it
         // Note: creditWallet uses its own transaction internally, so calling it inside tx might cause nested transaction issues if not careful.
         // Let's do it outside the transaction.
      }
    }

    return savedPost;
  });

  if (value.intent === "publish" && !value.id) {
    await creditWallet(userId, AF_COINS_EARN.WRITE_BLOG, "BLOG_POST", "Earned coins for writing a new blog post");
  }

  // Automatic email and WhatsApp notification for people who submit blogs
  if (value.intent === "publish" && existingPost?.status !== "PENDING_REVIEW" && existingPost?.status !== "PUBLISHED") {
    try {
      await sendBlogSubmissionNotification({
        userId,
        writerName: author.displayName,
        articleTitle: value.title,
      });
    } catch (notificationError) {
      console.error("Failed to send blog submission notification:", notificationError);
    }
  }

  // Sync to Meilisearch search index
  await syncBlogPostToMeili(post.id);

  // Invalidate Next.js cache paths
  revalidatePath("/blog");
  revalidatePath("/blog/my-posts");
  revalidatePath("/blog/search");
  revalidatePath(`/blog/${post.slug}`);
  if (value.categoryId) {
    const cat = await prisma.blogCategory.findUnique({ where: { id: value.categoryId }, select: { slug: true } });
    if (cat?.slug) {
      revalidatePath(`/blog/category/${cat.slug}`);
    }
  }

  return { success: true, ...post };
}
