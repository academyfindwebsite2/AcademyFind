"use client";

import React, { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatWhatsAppNumber } from "./AdminClaimWhatsAppButton";
import {
  buildInstituteRequestLinks,
  buildInstituteRequestWhatsAppMessage,
} from "@/lib/institutes/instituteRequestLinks";

export interface InstituteRequestData {
  id: string;
  instituteId: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  status: string;
  institute?: {
    id: string;
    name: string;
    slug?: string | null;
    city?: { name: string } | null;
  } | null;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

interface AdminRequestNotifyButtonProps {
  request: InstituteRequestData;
  className?: string;
}

export default function AdminRequestNotifyButton({
  request,
  className = "",
}: AdminRequestNotifyButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const phone = request.ownerPhone || request.user?.phone;
  const managerName = request.ownerName || request.user?.name || "Manager";
  const instituteName = request.institute?.name || "Your Institute";

  const { publicListingUrl, managerDashboardUrl } = buildInstituteRequestLinks(
    request.institute || { id: request.instituteId, name: instituteName }
  );

  const waPhone = formatWhatsAppNumber(phone);
  const waMessage = buildInstituteRequestWhatsAppMessage({
    managerName,
    instituteName,
    publicListingUrl,
    managerDashboardUrl,
  });

  const waUrl = waPhone
    ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(waMessage)}`
    : "";

  const handleOpenWhatsApp = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (waUrl) {
      window.open(waUrl, "_blank");
      setIsOpen(false);
    } else {
      toast.error("No valid mobile number available for WhatsApp.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:text-emerald-900 transition shadow-xs cursor-pointer ${className}`}
        title="Notify manager on WhatsApp"
      >
        <FaWhatsapp className="w-3.5 h-3.5 text-[#25D366]" />
        <span>Notify Manager</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white border border-slate-200 shadow-xl font-sans">
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <FaWhatsapp className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-slate-900 leading-tight">
                  Notify Institute Manager
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Request is approved. Send listing & dashboard links directly via WhatsApp.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Details Card */}
          <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-2">
            <div>
              <span className="font-extrabold text-slate-900 text-sm block">{instituteName}</span>
              <span className="text-slate-500">
                Manager: <strong className="text-slate-800">{managerName}</strong> ({phone || "No phone"})
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-600">
                <span>Public Listing:</span>
                <a
                  href={publicListingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  View Profile <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Manager Dashboard:</span>
                <a
                  href={managerDashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  Open Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold px-4"
            >
              Cancel
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
    </>
  );
}
