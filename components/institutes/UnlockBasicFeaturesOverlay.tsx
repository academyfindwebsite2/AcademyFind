"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

interface UnlockBasicFeaturesOverlayProps {
  instituteId: string;
  isLoggedIn: boolean;
  title?: string;
  description?: string;
}

export function UnlockBasicFeaturesOverlay({ instituteId, isLoggedIn, title = "Features", description }: UnlockBasicFeaturesOverlayProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleUnlockClick = () => {
    if (!isLoggedIn) {
      toast.error("Please login to unlock features.");
      router.push(buildAuthHref("/login", pathname));
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirmUnlock = async () => {
    setIsModalOpen(false);
    setIsLoading(true);
    try {
      const res = await fetch("/api/wallet/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 1,
          source: "SEE_COMMUNITY_BASIC_INSTITUTE",
          description: `Unlocked ${title} for institute ${instituteId}`,
          referenceId: instituteId,
          unlockType: "COMMUNITY",
          instituteId: instituteId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`1 AFC deducted. ${title} unlocked!`);
        router.refresh();
      } else {
        if (data.error && data.error.includes("Insufficient")) {
          toast((t) => (
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-slate-800">Not enough AFC Coins!</span>
              <button 
                onClick={() => {
                  toast.dismiss(t.id);
                  router.push("/how-to-earn-coins");
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-bold w-full text-center"
              >
                Earn Coins
              </button>
            </div>
          ), { duration: 6000, icon: '❌' });
        } else {
          toast.error(data.error || "Failed to unlock.");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[6px] rounded-3xl border border-slate-200/50 p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3 shadow-sm border border-amber-200">
          <Lock className="w-6 h-6 text-amber-500" />
        </div>
        <h4 className="text-xl font-bold text-slate-800">{title} Locked</h4>
        <p className="text-sm text-slate-700 mt-2 max-w-sm font-medium">
          {description || "Use 1 AFC Coin to unlock the full community profiles, contact details, and other hidden features of this institute."}
        </p>
        <button
          onClick={handleUnlockClick}
          disabled={isLoading}
          className="mt-5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-6 py-2.5 font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? "Unlocking..." : "Unlock (1 AFC)"}
        </button>
      </div>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmUnlock}
        title={`Unlock ${title}`}
        description="This will consume 1 AF Coin from your wallet. Do you want to proceed?"
        confirmText="Yes, Unlock (1 AFC)"
      />
    </>
  );
}
