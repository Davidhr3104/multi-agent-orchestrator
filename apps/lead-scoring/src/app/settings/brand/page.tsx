"use client";

import { useEffect, useState } from "react";
import { HelixPage } from "@/components/helix-page";
import { DEFAULT_BRAND, readBrand, writeBrand } from "@/lib/prefs";

export default function BrandPage() {
  const [primary, setPrimary] = useState(DEFAULT_BRAND.primary);
  const [logoUrl, setLogoUrl] = useState("");
  const [productName, setProductName] = useState(DEFAULT_BRAND.productName);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const b = readBrand();
    setPrimary(b.primary);
    setLogoUrl(b.logoUrl);
    setProductName(b.productName);
  }, []);

  return (
    <HelixPage title="White-label" hint="Agency portal: swap the lockup and primary accent. Stored in this browser.">
      <div className="card-bg max-w-lg space-y-4 rounded-xl p-5">
        <label className="block text-xs font-medium text-slate-400">
          Product name
          <input
            className="mt-1 h-8 w-full rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 text-sm text-slate-200"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Logo URL
          <input
            className="mt-1 h-8 w-full rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 text-sm text-slate-200"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://… or leave empty for Helix icon"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Primary color
          <input
            type="color"
            className="mt-1 h-8 w-16 cursor-pointer rounded border border-sky-900/50 bg-[#0a1e30]"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-900"
          style={{ background: primary }}
          onClick={() => {
            writeBrand({ primary, logoUrl, productName });
            setSaved(true);
          }}
        >
          Apply
        </button>
        {saved ? <p className="text-xs text-emerald-400">Applied. Reload if the sidebar logo lags.</p> : null}
      </div>
    </HelixPage>
  );
}
