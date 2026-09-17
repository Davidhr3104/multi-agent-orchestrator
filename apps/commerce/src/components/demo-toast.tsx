"use client";

import { useCallback, useState } from "react";

export function useDemoToast() {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);
  const node = toast ? (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border border-primary/30 bg-background/95 px-3 py-2 text-xs text-foreground shadow-lg"
    >
      {toast}
    </div>
  ) : null;
  return { show, node };
}
