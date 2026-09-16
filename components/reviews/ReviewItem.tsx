"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

export function ReviewItem({ review, isLoggedIn }: { review: any, isLoggedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleUserClick = (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setShowAuthModal(true);
    } else {
      router.push(`/u/${userId}`);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) {
      toast.error("Reply content cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit reply");

      toast.success("Reply submitted and pending admin approval.");
      setReplyContent("");
      setShowReplyForm(false);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div
        className="font-semibold text-slate-800 cursor-pointer hover:text-amber-600 inline-block transition-colors"
        onClick={(e) => handleUserClick(review.user.username || review.user.id, e)}
      >
        {review.user?.name || "Anonymous User"}
      </div>
      <div className="mt-2 text-amber-400">{"⭐".repeat(review.rating)}</div>
      {review.comment && <p className="mt-3 text-slate-600">{review.comment}</p>}

      <div className="mt-4">
        {isLoggedIn && (
          <Button variant="outline" size="sm" onClick={() => setShowReplyForm(!showReplyForm)}>
            Reply
          </Button>
        )}
      </div>

      {showReplyForm && (
        <div className="mt-4 flex flex-col gap-2">
          <Textarea
            placeholder="Write your reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowReplyForm(false)}>Cancel</Button>
            <Button onClick={handleReplySubmit} disabled={loading}>{loading ? "Submitting..." : "Submit"}</Button>
          </div>
        </div>
      )}

      {/* Render Approved Replies */}
      {review.replies && review.replies.length > 0 && (
        <div className="mt-6 space-y-4 border-l-2 border-slate-100 pl-4">
          {review.replies.map((reply: any) => (
            <div key={reply.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
              <div
                className="font-semibold text-slate-800 text-sm cursor-pointer hover:text-amber-600 inline-block transition-colors"
                onClick={(e) => handleUserClick(reply.user.username || reply.user.id, e)}
              >
                {reply.user?.name || "Anonymous User"}
              </div>
              <p className="mt-1 text-sm text-slate-600">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Auth Prompt Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-md rounded-3xl border-0 p-0 overflow-hidden z-150">
          <DialogHeader className="sr-only">
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>Please login to view user profiles and send messages.</DialogDescription>
          </DialogHeader>
          <div className="bg-linear-to-br from-amber-50 via-white to-orange-50 p-8">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
              <Sparkles className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="text-center text-2xl font-bold text-slate-900">Login to Connect</h2>
            <p className="mt-3 text-center text-sm text-zinc-600">
              Create a free account or login to view profiles and send messages directly.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href={buildAuthHref("/register", pathname)} onClick={() => setShowAuthModal(false)}>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={buildAuthHref("/login", pathname)} onClick={() => setShowAuthModal(false)}>
                <Button variant="outline" className="w-full font-semibold">Login</Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
