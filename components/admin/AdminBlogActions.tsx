"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Archive, ArchiveRestore, ExternalLink, Loader2, Pencil, Trash2, Check, X, BarChart2, MessageSquare } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { formatWhatsAppNumber } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { buildBlogSubmissionWhatsAppMessage } from "@/lib/notifications/blogTemplates";
import {
  archiveAdminBlogPost,
  unarchiveAdminBlogPost,
  deleteAdminBlogPost,
  updateAdminBlogStatus,
} from "@/lib/User/admin/admin-blog";

export default function AdminBlogActions({
  postId,
  slug,
  postTitle,
  isArchived,
  status,
  authorPhone,
  authorName,
}: {
  postId: string;
  slug: string;
  postTitle?: string | null;
  isArchived: boolean;
  status: string;
  authorPhone?: string | null;
  authorName?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const archive = () => {
    startTransition(async () => {
      const result = await archiveAdminBlogPost(postId);
      if (!result.success) {
        toast.error(result.error ?? "Unable to archive this post.");
        return;
      }
      toast.success("Post archived.");
      router.refresh();
    });
  };

  const unarchive = () => {
    startTransition(async () => {
      const result = await unarchiveAdminBlogPost(postId);
      if (!result.success) {
        toast.error(result.error ?? "Unable to unarchive this post.");
        return;
      }
      toast.success("Post unarchived to draft.");
      router.refresh();
    });
  };

  const updateStatus = (newStatus: "PUBLISHED" | "REJECTED" | "CONTACTED") => {
    startTransition(async () => {
      const result = await updateAdminBlogStatus(postId, newStatus);
      if (!result.success) {
        toast.error(result.error ?? `Unable to update post status.`);
        return;
      }
      toast.success(
        newStatus === "PUBLISHED"
          ? "Post published."
          : newStatus === "REJECTED"
          ? "Post rejected."
          : "Post marked as Messaged."
      );
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    startTransition(async () => {
      const result = await deleteAdminBlogPost(postId);
      if (!result.success) {
        toast.error(result.error ?? "Unable to delete this post.");
        setConfirmingDelete(false);
        return;
      }
      toast.success("Post permanently deleted.");
      router.refresh();
    });
  };

  const formattedWaPhone = authorPhone ? formatWhatsAppNumber(authorPhone) : "";

  return (
    <div className="flex items-center justify-end gap-1">
      {(status === "PENDING_REVIEW" || status === "CONTACTED") && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => updateStatus("PUBLISHED")}
            aria-label="Approve post"
            title="Approve post"
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
          >
            {isPending ? <Loader2 className="animate-spin size-4 mr-1" /> : <Check className="size-4 mr-1" />}
            Approve
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => updateStatus("REJECTED")}
            aria-label="Reject post"
            title="Reject post"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
          >
            {isPending ? <Loader2 className="animate-spin size-4 mr-1" /> : <X className="size-4 mr-1" />}
            Reject
          </Button>
          {status !== "CONTACTED" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => updateStatus("CONTACTED")}
              aria-label="Mark as Messaged"
              title="Mark as Messaged"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
            >
              {isPending ? <Loader2 className="animate-spin size-4 mr-1" /> : <MessageSquare className="size-4 mr-1" />}
              Messaged
            </Button>
          )}
          {formattedWaPhone && (
            <a
              href={`https://api.whatsapp.com/send?phone=${formattedWaPhone}&text=${encodeURIComponent(
                buildBlogSubmissionWhatsAppMessage({
                  writerName: authorName || "Writer",
                  articleTitle: postTitle || slug,
                })
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Send blog submission message to author on WhatsApp"
              className="inline-flex items-center justify-center size-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <FaWhatsapp className="size-4 text-[#25D366]" />
            </a>
          )}
        </>
      )}
      <Button asChild type="button" variant="ghost" size="icon-sm" title="View post">
        <Link href={`/blog/${slug}`} target="_blank" aria-label="View post">
          <ExternalLink />
        </Link>
      </Button>
      <Button asChild type="button" variant="ghost" size="icon-sm" title="Edit post">
        <Link
          href={`/af-ass-manage/blog/edit/${postId}`}
          aria-label="Edit post"
        >
          <Pencil />
        </Link>
      </Button>
      <Button asChild type="button" variant="ghost" size="icon-sm" title="View analytics">
        <Link
          href={`/af-ass-manage/blog/analytics/${postId}`}
          aria-label="View analytics"
        >
          <BarChart2 />
        </Link>
      </Button>
      {!isArchived ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={archive}
          aria-label="Archive post"
          title="Archive post"
          className="text-slate-500 hover:text-amber-700"
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Archive />}
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={unarchive}
          aria-label="Unarchive post"
          title="Unarchive post"
          className="text-slate-500 hover:text-emerald-700"
        >
          {isPending ? <Loader2 className="animate-spin" /> : <ArchiveRestore />}
        </Button>
      )}
      <Button
        type="button"
        variant={confirmingDelete ? "destructive" : "ghost"}
        size={confirmingDelete ? "sm" : "icon-sm"}
        disabled={isPending}
        onClick={remove}
        onBlur={() => setConfirmingDelete(false)}
        aria-label={confirmingDelete ? "Confirm delete" : "Delete post"}
        title={confirmingDelete ? "Confirm delete" : "Delete post"}
      >
        {isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Trash2 />
        )}
        {confirmingDelete ? "Confirm" : null}
      </Button>
    </div>
  );
}
