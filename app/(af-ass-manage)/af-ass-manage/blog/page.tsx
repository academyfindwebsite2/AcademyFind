import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  FileText,
  MessageCircle,
  Plus,
  Search,
  Star,
} from "lucide-react";

import { BlogStatus } from "@/app/generated/prisma/enums";
import AdminBlogActions from "@/components/admin/AdminBlogActions";
import AdminBlogFilter from "@/components/admin/AdminBlogFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Blog Management | AcademyFind Admin",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 15;
const ALL = "ALL";

const statusStyles: Record<BlogStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-800",
  PENDING_REVIEW: "bg-violet-100 text-violet-800",
  CONTACTED: "bg-sky-100 text-sky-800 border border-sky-200",
  SCHEDULED: "bg-white/80 backdrop-blur-md border border-stone-200/50 text-stone-900 shadow-sm",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  ARCHIVED: "bg-slate-200 text-slate-700",
};

type AdminBlogPageProps = {
  searchParams: Promise<{
    page?: string;
    query?: string;
    status?: string;
    brand?: string;
  }>;
};

// Interface reflecting the specific fields selected via Prisma
interface PostListItem {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  status: BlogStatus;
  visibility: string;
  isFeatured: boolean;
  isPinned: boolean;
  viewCount: number;
  commentCount: number;
  updatedAt: Date;
  publishedAt: Date | null;
  brand: { id: string; name: string; avatarUrl: string | null } | null;
  authorProfile: {
    displayName: string;
    user?: {
      name: string | null;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
  relatedInstitute?: {
    name: string;
    phone: string | null;
  } | null;
  category: { name: string } | null;
}

export default async function AdminBlogPage({
  searchParams,
}: AdminBlogPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.query?.trim() ?? "";

  const status = Object.values(BlogStatus).includes(params.status as BlogStatus)
    ? (params.status as BlogStatus)
    : undefined;

  const brandId = params.brand && params.brand !== ALL ? params.brand : undefined;

  const where = {
    ...(query
      ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
        ],
      }
      : {}),
    ...(status ? { status } : {}),
    ...(brandId ? { brandId } : {}),
  };

  const [posts, total, groupedStatuses, brands] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
        updatedAt: true,
        publishedAt: true,
        brand: {
          select: { id: true, name: true, avatarUrl: true },
        },
        authorProfile: {
          select: {
            displayName: true,
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        relatedInstitute: {
          select: {
            name: true,
            phone: true,
          },
        },
        category: {
          select: { name: true },
        },
      },
    }) as Promise<PostListItem[]>,
    prisma.blogPost.count({ where }),
    prisma.blogPost.groupBy({ by: ["status"], _count: true }),
    prisma.blogBrand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const counts = Object.fromEntries(
    groupedStatuses.map((item: { status: string; _count: number }) => [item.status, item._count]),
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildPageHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status) next.set("status", status);
    if (brandId) next.set("brand", brandId);
    next.set("page", String(targetPage));
    return `/af-ass-manage/blog?${next.toString()}`;
  };

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900">
            <FileText className="size-8 text-purple-600" />
            Blog management
          </h1>
          <p className="mt-1 text-slate-500">
            Create brand stories, moderate contributors, and control publishing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link prefetch={false} href="/af-ass-manage/blog/brands">Manage brands</Link>
          </Button>
          <Button asChild className="bg-purple-600 text-white hover:bg-purple-700">
            <Link prefetch={false} href="/af-ass-manage/blog/new">
              <Plus className="mr-2 size-4" />
              New brand post
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-semibold uppercase text-violet-700">Awaiting review</p>
          <p className="mt-1 text-2xl font-bold text-violet-900">
            {counts.PENDING_REVIEW ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-semibold uppercase text-sky-700">Messaged</p>
          <p className="mt-1 text-2xl font-bold text-sky-900">
            {counts.CONTACTED ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-700">Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">
            {counts.PUBLISHED ?? 0}
          </p>
        </div>
      </div>

      <AdminBlogFilter
        query={query}
        status={status}
        brandId={brandId}
        brands={brands}
        ALL={ALL}
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-4">Post</th>
              <th className="p-4">Attribution</th>
              <th className="p-4">Status</th>
              <th className="p-4">Performance</th>
              <th className="p-4">Updated / Published</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100/50">
            {posts.map((post: any) => (
              <tr key={post.id} className="hover:bg-slate-50/60">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {post.coverImage && (
                        <Image
                          src={post.coverImage}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="max-w-sm">
                      <p className="line-clamp-1 font-semibold text-slate-900">
                        {post.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        /{post.slug}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        {post.isFeatured && (
                          <Star className="size-3.5 fill-stone-400 text-stone-400" />
                        )}
                        {post.isPinned && (
                          <Badge variant="outline" className="h-4 text-[10px]">
                            Pinned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-medium text-slate-700">
                    {post.brand?.name ?? post.authorProfile?.displayName ?? "Unattributed"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {post.brand ? "Brand" : "Contributor"}
                  </p>
                </td>
                <td className="p-4">
                  <Badge className={statusStyles[post.status as BlogStatus]}>
                    {post.status === "CONTACTED" ? "Messaged" : post.status.toLocaleLowerCase().replaceAll("_", " ")}
                  </Badge>
                  <p className="mt-1 text-xs text-slate-400">
                    {post.visibility?.toLocaleLowerCase()}
                  </p>
                </td>
                <td className="p-4">
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {post.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="size-3.5" />
                      {post.commentCount}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-xs text-slate-500">
                  <p>Upd: {post.updatedAt.toLocaleDateString("en-IN")}</p>
                  {post.publishedAt && (
                    <p className="mt-1 text-slate-400">Pub: {post.publishedAt.toLocaleDateString("en-IN")}</p>
                  )}
                </td>
                <td className="p-4">
                  <AdminBlogActions
                    postId={post.id}
                    slug={post.slug}
                    postTitle={post.title}
                    isArchived={post.status === "ARCHIVED"}
                    status={post.status}
                    authorPhone={post.authorProfile?.user?.phone || post.relatedInstitute?.phone}
                    authorName={post.authorProfile?.displayName || post.authorProfile?.user?.name || post.relatedInstitute?.name}
                  />
                </td>
              </tr>
            ))}
            {!posts.length && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500">
                  No posts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {hasPrevious ? (
              <Button asChild variant="outline">
                <Link prefetch={false} href={buildPageHref(page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Previous
              </Button>
            )}

            {hasNext ? (
              <Button asChild variant="outline">
                <Link prefetch={false} href={buildPageHref(page + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}