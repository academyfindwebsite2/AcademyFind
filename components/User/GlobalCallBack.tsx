"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, HeadphonesIcon, X } from "lucide-react";
import { requestGlobalCallback } from "@/lib/User/user/global-callback";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

export interface GlobalCallbackFABProps {
    defaultName?: string | null;
    defaultPhone?: string | null;
}

export default function GlobalCallbackFAB({ defaultName, defaultPhone }: GlobalCallbackFABProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [currentUrl, setCurrentUrl] = useState("");

    // Capture the URL so admins know where the user was stuck
    useEffect(() => {
        if (isOpen) {
            setCurrentUrl(window.location.href);
        } else {
            setTimeout(() => {
                setIsSuccess(false);
                setError("");
            }, 300);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        formData.append("sourceUrl", currentUrl);

        const res = await requestGlobalCallback(formData);
        if (res.success) {
            setIsSuccess(true);
        } else {
            setError(res.error || "Failed to submit.");
        }
        setIsSubmitting(false);
    };

    return (
        <div className="fixed bottom-3 right-3 md:bottom-6 md:right-6 z-[102]">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                {/* 🚀 FAB Button acts as the trigger */}
                <PopoverTrigger asChild>
                    <button
                        className="flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-white rounded-full p-4 md:px-5 md:py-3 shadow-2xl hover:scale-105 transition-all duration-300 group"
                    >
                        <div className="relative">
                            {/* 🚀 Icon swaps to 'X' when open */}
                            {isOpen ? <X className="w-5 h-5" /> : <HeadphonesIcon className="w-5 h-5" />}

                            {!isOpen && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                </span>
                            )}
                        </div>
                        <span className="hidden md:inline text-sm font-bold">
                            {isOpen ? "Close" : "Talk to Expert"}
                        </span>
                    </button>
                </PopoverTrigger>

                {/* 🚀 Popover opens exactly above the button */}
                <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={12}
                    collisionPadding={{ left: 16, right: 16, top: 16, bottom: 16 }}
                    className="w-[320px] sm:w-[90vw] sm:max-w-[340px] z-[100] rounded-3xl p-0 overflow-hidden shadow-2xl border border-slate-200 origin-bottom-right animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                >
                    <div className="bg-amber-400 p-5 text-white text-center relative shrink-0">
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-amber-500/50 transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                        <HeadphonesIcon className="w-8 h-8 mx-auto mb-2 opacity-90" />
                        <h3 className="text-xl font-extrabold tracking-tight">Need Help?</h3>
                        <p className="text-amber-100 mt-1 text-sm leading-snug">
                            Leave your number and our expert counselors will call you back shortly.
                        </p>
                    </div>

                    <div className="p-5 bg-white overflow-y-auto">
                        {isSuccess ? (
                            <div className="text-center py-6 animate-in zoom-in duration-300">
                                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                                <h4 className="font-bold text-slate-800 text-lg">Request Sent!</h4>
                                <p className="text-slate-500 text-sm mt-1">We will get back to you within 24 hours.</p>

                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <p className="text-sm font-medium text-slate-600 mb-3">Want to explore on your own?</p>
                                    <Link href={buildAuthHref("/login", pathname)} onClick={() => setIsOpen(false)}>
                                        <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                                            Login / Sign Up
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name *</label>
                                        <input
                                            required
                                            type="text"
                                            name="name"
                                            placeholder="Rahul Kumar"
                                            defaultValue={defaultName || ""}
                                            className="w-full mt-1 p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mobile Number *</label>
                                        <input
                                            required
                                            type="tel"
                                            name="phone"
                                            pattern="[0-9]{10}"
                                            title="Please enter a valid 10-digit mobile number"
                                            placeholder="+91 98765 43210"
                                            defaultValue={defaultPhone || ""}
                                            className="w-full mt-1 p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Message <span className="text-slate-400 normal-case">(optional)</span></label>
                                        <textarea
                                            name="message"
                                            rows={3}
                                            placeholder="Tell us what you need help with... (optional)"
                                            className="w-full mt-1 p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                <Button disabled={isSubmitting} type="submit" className="w-full bg-amber-400 hover:bg-amber-500 text-white py-5 mt-2 rounded-xl font-bold">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Callback"}
                                </Button>
                                <p className="text-[10px] text-center text-slate-400 mt-2">By submitting, you agree to our Privacy Policy.</p>
                            </form>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}