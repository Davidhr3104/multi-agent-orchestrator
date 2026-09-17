"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function useDemoToast() {
  const [toast, setToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const show = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const node =
    mounted && toast
      ? createPortal(
          <div
            role="status"
            className="fixed right-4 bottom-4 z-[200] max-w-sm rounded-lg border border-primary/40 bg-background px-3 py-2 text-xs text-foreground shadow-2xl"
          >
            {toast}
          </div>,
          document.body
        )
      : null;

  return { show, node };
}
