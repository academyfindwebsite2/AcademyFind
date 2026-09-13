"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth/auth-client";

export function GoogleOneTap() {
  const { data: session, isPending } = authClient.useSession();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isPending && !session && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      authClient
        .oneTap({
          cancelOnTapOutside: true,
          context: "signin",
        })
        .catch((err: any) => {
          // Gracefully ignore benign AbortError / dismissal from user
          if (
            err?.name === "AbortError" ||
            err?.message?.includes("aborted") ||
            err?.message?.includes("dismissed")
          ) {
            return;
          }
          console.warn("Google One Tap notice:", err);
        });
    }
  }, [session, isPending]);

  return null;
}
