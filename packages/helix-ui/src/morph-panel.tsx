"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { HelixAvatar, type HelixAvatarDesk } from "./helix-avatar";

export type MorphChip = { label: string; question: string };

export function MorphPanel({
  title = "Ask Helix",
  placeholder = "Ask this desk about the open record…",
  logoSrc,
  avatarDesk,
  accent = "#1ad4c4",
  accentInk = "#070b0d",
  chips = [],
  busy = false,
  disabled = false,
  onAsk,
}: {
  title?: string;
  placeholder?: string;
  /** Official desk mark only — never recolor. */
  logoSrc?: string;
  /** When set, the animated desk avatar replaces the static mark (it thinks while `busy`). */
  avatarDesk?: HelixAvatarDesk;
  /** Desk primary for the send button. */
  accent?: string;
  accentInk?: string;
  chips?: MorphChip[];
  busy?: boolean;
  disabled?: boolean;
  onAsk: (question: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const labelId = useId();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy || disabled) return;
    onAsk(t);
    setQ("");
    setOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(q);
  }

  const shell: CSSProperties = {
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#070b0d",
    color: "#fff",
    boxShadow: "0 24px 60px -24px rgba(10,13,16,0.55)",
    borderRadius: open ? 28 : 999,
    padding: open ? 16 : "6px 8px",
    transition: "border-radius 280ms cubic-bezier(0.22,1,0.36,1), padding 280ms cubic-bezier(0.22,1,0.36,1)",
  };

  return (
    <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
      <div style={shell}>
        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            ...(open
              ? {
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.06)",
                  padding: "8px 8px",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }
              : {}),
          }}
        >
          <span
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: avatarDesk ? 56 : 40,
              height: avatarDesk ? 56 : 40,
              flex: "none",
            }}
          >
            {avatarDesk ? (
              <HelixAvatar desk={avatarDesk} state={busy ? "thinking" : "idle"} size={52} decorative />
            ) : logoSrc ? (
              <img src={logoSrc} alt="" width={28} height={28} style={{ width: 28, height: 28, objectFit: "contain" }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5eead9" strokeWidth="1.75">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            )}
          </span>
          {open ? (
            <input
              ref={inputRef}
              id={labelId}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              disabled={busy || disabled}
              aria-label={title}
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: 14,
                padding: "8px 0",
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={disabled}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "left",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                fontSize: 14,
                padding: "8px 8px 8px 0",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {title}
            </button>
          )}
          <button
            type={open ? "submit" : "button"}
            onClick={open ? undefined : () => setOpen(true)}
            disabled={busy || disabled || (open && !q.trim())}
            aria-label={open ? "Ask this desk" : `Open ${title}`}
            style={{
              display: "grid",
              placeItems: "center",
              width: 40,
              height: 40,
              flex: "none",
              borderRadius: 999,
              border: "none",
              background: accent,
              color: accentInk,
              cursor: busy || disabled ? "not-allowed" : "pointer",
              opacity: busy || disabled || (open && !q.trim()) ? 0.55 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        {open ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, padding: "0 4px", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              {busy ? "Reading the open record…" : "Ask reads the open record · not a chatbot"}
            </p>
            {chips.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    disabled={busy || disabled}
                    onClick={() => submit(chip.question)}
                    style={{
                      borderRadius: 999,
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.85)",
                      background: "rgba(255,255,255,0.06)",
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                      border: "none",
                      cursor: busy || disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
