"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptIsmInvite, declineIsmInvite } from "@/lib/instituteSalesManager/ismInviteActions";
import { CheckCircle2, XCircle, Loader2, GraduationCap } from "lucide-react";

interface Props {
  inviteId: string;
  instituteName: string;
  instituteId: string;
}

export default function IsmInviteResponseClient({ inviteId, instituteName, instituteId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [result, setResult] = useState<{ type: "accepted" | "declined" | "error"; msg: string } | null>(null);
  const [confirming, setConfirming] = useState<"accept" | "decline" | null>(null);

  function handleAccept() {
    setAction("accept");
    startTransition(async () => {
      const res = await acceptIsmInvite(inviteId);
      if (res.success) {
        setResult({ type: "accepted", msg: res.message || `Welcome aboard! You're now an ISM for ${instituteName}.` });
        // After 2s redirect to their new ISM dashboard
        setTimeout(() => {
          if (res.userId) {
            window.location.href = `/institute_sales/${instituteId}/${res.userId}`;
          } else {
            window.location.href = `/institute_sales`;
          }
        }, 2000);
      } else {
        setResult({ type: "error", msg: res.error || "Something went wrong." });
        setAction(null);
      }
    });
  }

  function handleDecline() {
    setAction("decline");
    startTransition(async () => {
      const res = await declineIsmInvite(inviteId);
      if (res.success) {
        setResult({ type: "declined", msg: "You've declined the invite. You can close this page." });
      } else {
        setResult({ type: "error", msg: res.error || "Something went wrong." });
        setAction(null);
      }
    });
  }

  if (result) {
    return (
      <div className={`p-5 rounded-2xl border text-center space-y-3 ${
        result.type === "accepted"
          ? "bg-green-50 border-green-200"
          : result.type === "declined"
          ? "bg-slate-50 border-slate-200"
          : "bg-red-50 border-red-200"
      }`}>
        {result.type === "accepted" && (
          <>
            <GraduationCap className="w-10 h-10 text-green-600 mx-auto" />
            <p className="font-extrabold text-green-800 text-lg">🎉 Welcome to the team!</p>
            <p className="text-sm text-green-700">{result.msg}</p>
            <p className="text-xs text-green-600 flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Redirecting to your dashboard...
            </p>
          </>
        )}
        {result.type === "declined" && (
          <>
            <XCircle className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="font-bold text-slate-700">{result.msg}</p>
          </>
        )}
        {result.type === "error" && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="font-bold text-red-700">{result.msg}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Confirm decline prompt */}
      {confirming === "decline" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3">
          <p className="font-bold text-red-800 text-sm">Are you sure you want to decline?</p>
          <p className="text-xs text-red-600">You can always be re-invited later.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDecline}
              disabled={isPending}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
            >
              {isPending && action === "decline" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Yes, Decline
            </button>
            <button
              onClick={() => setConfirming(null)}
              className="flex-1 py-2 bg-white border border-red-200 text-red-700 rounded-xl text-sm font-bold hover:bg-red-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirming !== "decline" && (
        <div className="flex gap-3">
          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-extrabold text-sm transition flex items-center justify-center gap-2 shadow-sm"
          >
            {isPending && action === "accept"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />
            }
            Accept Invite
          </button>

          {/* Decline */}
          <button
            onClick={() => setConfirming("decline")}
            disabled={isPending}
            className="flex-1 py-3 bg-white hover:bg-red-50 border border-red-200 text-red-700 rounded-2xl font-extrabold text-sm transition flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
