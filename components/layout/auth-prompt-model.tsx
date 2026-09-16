"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

import { authClient } from "@/lib/auth/auth-client";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

export function AuthPromptModal({
  isAuthenticated = false,
}: {
  isAuthenticated?: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const isSignedIn = isAuthenticated || Boolean(session?.user);

  useEffect(() => {
    if (isSignedIn) {
      setOpen(false);
      return;
    }

    const excludedRoutes = [
      "/login",
      "/register",
      "/confirm-otp",
      "/user-create-institute"
    ];

    if (excludedRoutes.includes(pathname)) {
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      setOpen(true);
    }, 15000);

    return () => clearTimeout(timer);
  }, [pathname, isSignedIn]);

  if (isSignedIn) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-3xl border border-amber-100 p-0 overflow-hidden z-[1050] bg-white shadow-2xl">

        {/* 🚀 FIX: Isko 'sr-only' de diya taaki Accessibility Warning na aaye aur HTML invalid na ho */}
        <DialogHeader className="sr-only">
          <DialogTitle>Want to Explore More?</DialogTitle>
          <DialogDescription>
            Create your free account to save institutes, compare coaching centers, write reviews, and get personalized recommendations.
          </DialogDescription>
        </DialogHeader>

        {/* 🎨 Aapka Beautiful Visual UI */}
        <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/50 p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
            <Sparkles className="h-7 w-7 text-amber-600" />
          </div>

          <h2 className="text-center text-2xl font-bold text-slate-900">
            Want to Explore More?
          </h2>

          <p className="mt-3 text-center text-sm text-zinc-600">
            Create your free account to save institutes,
            compare coaching centers, write reviews,
            and get personalized recommendations.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {/* Added onClick to close modal instantly when navigating */}
            <Link href={buildAuthHref("/register", pathname)} onClick={() => setOpen(false)}>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            <Link href={buildAuthHref("/login", pathname)} onClick={() => setOpen(false)}>
              <Button
                variant="outline"
                className="w-full font-semibold"
              >
                Login
              </Button>
            </Link>
          </div>

          <p className="mt-5 text-center text-xs text-zinc-500">
            Join thousands of students discovering the
            best coaching institutes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}