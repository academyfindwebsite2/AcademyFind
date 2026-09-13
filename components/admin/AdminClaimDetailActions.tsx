"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  PhoneCall,
  Mail,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import toast from "react-hot-toast";
import { updateClaimStatus } from "@/lib/User/admin/adminClaim";
import { deleteClaimAction } from "@/app/(af-ass-manage)/af-ass-manage/claims/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  buildApprovalLinks,
  buildApprovalWhatsAppMessage,
  buildApprovalWhatsAppUrl,
} from "@/lib/institutes/claimLinks";
import { ClaimData } from "./AdminClaimRowActions";

interface AdminClaimDetailActionsProps {
  claim: ClaimData & {
    userId?: string;
    role?: string;
    message?: string | null;
    createdAt?: any;
    updatedAt?: any;
  };
}

export default function AdminClaimDetailActions({ claim }: AdminClaimDetailActionsProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(claim.status);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const waUrl = buildApprovalWhatsAppUrl(claim);
  const waMessage = buildApprovalWhatsAppMessage(claim);
  const { publicListingUrl, managerDashboardUrl } = buildApprovalLinks(claim);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await updateClaimStatus(claim.id, "APPROVED");
      if (res && res.success) {
        toast.success("Claim approved successfully! 🎉");
        setCurrentStatus("APPROVED");
        router.refresh();
        setIsNotifyOpen(true);
      } else {
        toast.error((res as any)?.error || "Failed to approve claim");
      }
    } catch (err: any) {
      console.error("Error approving claim:", err);
      toast.error("Failed to approve claim");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectConfirm = async () => {
    setIsRejecting(true);
    try {
      const res = await updateClaimStatus(claim.id, "REJECTED");
      if (res && res.success) {
        toast.success("Claim marked as rejected");
        setCurrentStatus("REJECTED");
        router.refresh();
      } else {
        toast.error((res as any)?.error || "Failed to reject claim");
      }
    } catch (err: any) {
      console.error("Error rejecting claim:", err);
      toast.error("Failed to reject claim");
    } finally {
      setIsRejecting(false);
      setIsRejectConfirmOpen(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteClaimAction(claim.id);
      if (res.success) {
        toast.success("Claim deleted successfully");
        router.push("/af-ass-manage/claims");
      } else {
        toast.error(res.error || "Failed to delete claim");
      }
    } catch (err: any) {
      console.error("Error deleting claim:", err);
      toast.error("An error occurred while deleting");
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(waMessage);
    setCopiedMessage(true);
    toast.success("Message copied to clipboard!");
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (waUrl) {
      window.open(waUrl, "_blank");
      setIsNotifyOpen(false);
    } else {
      toast.error("No valid phone number for WhatsApp");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Approve / Reject / WhatsApp Actions */}
        {currentStatus === "PENDING" && (
          <>
            <button
              type="button"
              onClick={() => setIsRejectConfirmOpen(true)}
              disabled={isApproving || isRejecting || isDeleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject Claim</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving || isRejecting || isDeleting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 border border-emerald-700 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {isApproving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{isApproving ? "Approving..." : "Approve Claim"}</span>
            </button>
          </>
        )}

        {currentStatus === "APPROVED" && (
          <>
            <button
              type="button"
              onClick={() => setIsNotifyOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl hover:bg-emerald-100 hover:text-emerald-900 transition-all shadow-xs cursor-pointer"
            >
              <FaWhatsapp className="w-4 h-4 text-[#25D366]" />
              <span>Notify Manager via WhatsApp</span>
            </button>

            <a
              href={managerDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Manager Dashboard</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
            </a>
          </>
        )}

        {currentStatus === "REJECTED" && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all shadow-xs cursor-pointer"
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Re-Approve Claim</span>
          </button>
        )}

        {/* Delete Claim Button */}
        <button
          type="button"
          onClick={() => setIsDeleteConfirmOpen(true)}
          disabled={isDeleting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-500 bg-white border border-red-200 rounded-xl hover:bg-red-50 hover:text-red-700 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          title="Delete Claim Request"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          <span>Delete</span>
        </button>
      </div>

      {/* 🚀 Notify Manager Dialog */}
      <Dialog open={isNotifyOpen} onOpenChange={setIsNotifyOpen}>
        <DialogContent className="sm:max-w-lg p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl">
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                <FaWhatsapp className="w-6 h-6 text-[#25D366]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 leading-tight">
                  Notify Institute Manager
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Send official approval notice, public profile URL, and manager dashboard link.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Details Pill */}
          <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-700 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                {claim.institute?.name || "Institute"}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Approved
              </span>
            </div>
            <div className="text-slate-600 flex items-center justify-between">
              <span>Manager: <strong className="text-slate-800">{claim.fullName}</strong></span>
              <span className="font-mono text-slate-700">{claim.phone}</span>
            </div>
          </div>

          {/* WhatsApp Message Preview */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3.5 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
              {waMessage}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNotifyOpen(false)}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold px-4"
            >
              Close
            </Button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <FaWhatsapp className="w-4 h-4" />
              <span>Send via WhatsApp</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation */}
      <ConfirmModal
        isOpen={isRejectConfirmOpen}
        onClose={() => setIsRejectConfirmOpen(false)}
        onConfirm={handleRejectConfirm}
        title="Reject Claim Request?"
        description={`Are you sure you want to reject the ownership claim for ${
          claim.institute?.name || "this institute"
        } submitted by ${claim.fullName}? The status will be set to REJECTED.`}
        confirmText="Yes, Reject"
        destructive={true}
        loading={isRejecting}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Claim Request Permanently?"
        description={`Are you sure you want to permanently delete this claim request from ${claim.fullName}? This action cannot be undone.`}
        confirmText="Yes, Delete Permanently"
        destructive={true}
        loading={isDeleting}
      />
    </>
  );
}
