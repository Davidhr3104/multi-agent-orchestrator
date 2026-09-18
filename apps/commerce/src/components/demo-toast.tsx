"use client";

export function showCommerceToast(message: string) {
  if (typeof document === "undefined") return;
  document.getElementById("helix-commerce-toast")?.remove();
  const el = document.createElement("div");
  el.id = "helix-commerce-toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  el.className =
    "pointer-events-none fixed right-4 bottom-4 z-[9999] max-w-sm rounded-lg border border-emerald-500/40 bg-zinc-950 px-3 py-2 text-xs text-emerald-100 shadow-2xl";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 4000);
}
