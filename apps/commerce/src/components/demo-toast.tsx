"use client";

import { useEffect, useState } from "react";

const EVENT = "helix-commerce-toast";

export function showCommerceToast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function CommerceToastHost() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    function onToast(event: Event) {
      const message = (event as CustomEvent<string>).detail;
      if (!message) return;
      setToast(message);
      window.setTimeout(() => setToast(null), 4000);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed right-4 bottom-4 z-[200] max-w-sm rounded-lg border border-primary/40 bg-background px-3 py-2 text-xs text-foreground shadow-2xl"
    >
      {toast}
    </div>
  );
}
