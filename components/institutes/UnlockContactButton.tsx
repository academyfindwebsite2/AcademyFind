"use client";

import { useState } from "react";
import { Lock, Phone, Globe, Mail, Share2, Sparkles } from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaTelegram, FaTwitter, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

interface UnlockContactButtonProps {
  type: "phone" | "website" | "email" | "social";
  hiddenValue: string;
  realValue?: string;
  socialUrls?: {
    instagram?: string | null;
    facebook?: string | null;
    youtube?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
    whatsapp?: string | null;
    telegram?: string | null;
  };
  isLoggedIn: boolean;
  instituteId: string;
  instituteName?: string;
}

export function UnlockContactButton({
  type,
  hiddenValue,
  realValue = "",
  socialUrls,
  isLoggedIn,
  instituteId,
  instituteName,
}: UnlockContactButtonProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleUnlockClick = () => {
    if (!isLoggedIn) {
      toast.error("Please login to unlock contact details.");
      router.push(buildAuthHref("/login", pathname));
      return;
    }

    if (isUnlocked) return;
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
          source: "SEE_CONTACT_BASIC_INSTITUTE",
          description: `Viewed ${type} for institute ${instituteId}`,
          referenceId: instituteId,
          unlockType: type,
          instituteId: instituteId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsUnlocked(true);
        toast.success(`1 AFC deducted. ${type === "social" ? "Social profiles" : type} unlocked!`);
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

  // ── 1. UNLOCKED VIEW ──
  if (isUnlocked) {
    if (type === "social") {
      const hasAnyLink = socialUrls && (
        socialUrls.instagram ||
        socialUrls.facebook ||
        socialUrls.youtube ||
        socialUrls.linkedin ||
        socialUrls.twitter ||
        socialUrls.whatsapp ||
        socialUrls.telegram
      );

      return (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-amber-500" /> Social Links:
          </span>
          {socialUrls?.whatsapp && (
            <a href={socialUrls.whatsapp} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:scale-125 transition-transform" title="WhatsApp">
              <FaWhatsapp className="h-5 w-5" />
            </a>
          )}
          {socialUrls?.instagram && (
            <a href={socialUrls.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:scale-125 transition-transform" title="Instagram">
              <FaInstagram className="h-5 w-5" />
            </a>
          )}
          {socialUrls?.facebook && (
            <a href={socialUrls.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:scale-125 transition-transform" title="Facebook">
              <FaFacebook className="h-5 w-5" />
            </a>
          )}
          {socialUrls?.youtube && (
            <a href={socialUrls.youtube} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:scale-125 transition-transform" title="YouTube">
              <FaYoutube className="h-5 w-5" />
            </a>
          )}
          {socialUrls?.linkedin && (
            <a href={socialUrls.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:scale-125 transition-transform" title="LinkedIn">
              <FaLinkedin className="h-5 w-5" />
            </a>
          )}
          {socialUrls?.twitter && (
            <a href={socialUrls.twitter} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:scale-125 transition-transform" title="Twitter / X">
              <FaTwitter className="h-5 w-5" />
            </a>
          )}
          {socialUrls?.telegram && (
            <a href={socialUrls.telegram} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:scale-125 transition-transform" title="Telegram">
              <FaTelegram className="h-5 w-5" />
            </a>
          )}
          {!hasAnyLink && (
            <span className="text-xs text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded">
              No direct social links added by this institute yet.
            </span>
          )}
        </div>
      );
    }

    if (type === "website") {
      return (
        <a href={realValue} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700">
          <Globe className="h-4 w-4" /> {realValue}
        </a>
      );
    }
    if (type === "phone") {
      return (
        <a href={`tel:${realValue}`} className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700">
          <Phone className="h-4 w-4" /> {realValue}
        </a>
      );
    }
    return (
      <a href={`mailto:${realValue}`} className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700">
        <Mail className="h-4 w-4" /> {realValue}
      </a>
    );
  }

  // ── 2. LOCKED SOCIAL MEDIA VIEW (WITH SLEEK BLUR EFFECT) ──
  if (type === "social") {
    return (
      <>
        <button
          onClick={handleUnlockClick}
          disabled={isLoading}
          className="flex items-center flex-wrap gap-2.5 text-sm font-medium text-slate-500 hover:text-amber-600 transition group focus:outline-none text-left pt-1"
          title="Unlock Social Media Channels for 1 AFC"
        >
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 shrink-0">
            <Share2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors" /> Socials
          </span>

          <div className="flex items-center gap-2.5 py-1 px-2.5 rounded-xl bg-slate-200/50 border border-slate-200/80 filter blur-[2.5px] group-hover:blur-[1px] transition-all opacity-80 select-none">
            <FaWhatsapp className="h-4 w-4 text-emerald-600" />
            <FaInstagram className="h-4 w-4 text-pink-600" />
            <FaFacebook className="h-4 w-4 text-blue-600" />
            <FaYoutube className="h-4 w-4 text-red-600" />
            <FaLinkedin className="h-4 w-4 text-blue-700" />
            <FaTwitter className="h-4 w-4 text-sky-500" />
            <FaTelegram className="h-4 w-4 text-blue-500" />
          </div>

          <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ml-0.5 shadow-2xs border border-amber-200 group-hover:bg-amber-200 transition-colors">
            {isLoading ? "Unlocking..." : "Show (1 AFC)"}
            {!isLoading && <Lock className="h-3 w-3" />}
          </span>
        </button>

        <ConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmUnlock}
          title="Unlock Social Media Links"
          description="This will consume 1 AF Coin from your wallet to view institute social links. Do you want to proceed?"
          confirmText="Yes, Unlock (1 AFC)"
        />
      </>
    );
  }

  // ── 3. LOCKED REGULAR CONTACT VIEW ──
  const Icon = type === "phone" ? Phone : type === "website" ? Globe : Mail;

  return (
    <>
      <button
        onClick={handleUnlockClick}
        disabled={isLoading}
        className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-amber-600 transition group focus:outline-none"
        title={`Unlock ${type} for 1 AFC`}
      >
        <Icon className="h-4 w-4 text-slate-300 group-hover:text-amber-500" />
        <span className="blur-[3px] bg-slate-200/50 rounded px-1 group-hover:blur-sm transition-all">{hiddenValue}</span>
        <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ml-1 shadow-2xs border border-amber-200 group-hover:bg-amber-200 transition-colors">
          {isLoading ? "Unlocking..." : "Show (1 AFC)"}
          {!isLoading && <Lock className="h-3 w-3" />}
        </span>
      </button>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmUnlock}
        title="Unlock Contact Info"
        description="This will consume 1 AF Coin from your wallet. Do you want to proceed?"
        confirmText="Yes, Unlock (1 AFC)"
      />
    </>
  );
}
