"use client";

import type { ReactNode } from "react";
import { HelixAvatar, type HelixAvatarDesk } from "./helix-avatar";

/**
 * The opening of a fresh chat: the desk's avatar in the middle, a greeting with the person's name when
 * we really know it, and the question below. Colors come from currentColor so it fits every app theme.
 */

/** "Good morning / afternoon / evening" from a 0-23 hour. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * A friendly first name from a session email ("john.smith@acme.com" -> "John").
 * Returns undefined rather than guessing when the local part is not name-like (empty, digits only).
 */
export function displayNameFromEmail(email: string | null | undefined): string | undefined {
  const local = (email ?? "").split("@")[0]?.trim();
  if (!local) return undefined;
  const first = local.split(/[._\-+\s]+/)[0];
  if (!first || !/[a-zA-Z]/.test(first)) return undefined;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function HelixWelcome({
  desk,
  name,
  title,
  hour,
  children,
  className,
}: {
  desk: HelixAvatarDesk;
  /** only pass a real name; without one the greeting is just "Welcome back" */
  name?: string | null;
  /** the question under the avatar, e.g. "What should we triage?" */
  title: string;
  /** override the hour (0-23); defaults to the viewer's local time */
  hour?: number;
  /** anything the app already showed in its empty state (hint, demo button) */
  children?: ReactNode;
  className?: string;
}) {
  const cleanName = name?.trim();
  const greeting = cleanName ? `${greetingFor(hour ?? new Date().getHours())}, ${cleanName}` : "Welcome back";

  return (
    <section
      aria-label="Welcome"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 6,
        minHeight: "min(52vh, 460px)",
        padding: "24px 0",
      }}
    >
      <HelixAvatar desk={desk} size={120} decorative />
      <p style={{ margin: "14px 0 0", fontSize: 14, letterSpacing: "0.02em", opacity: 0.65 }}>{greeting}</p>
      <h3 style={{ margin: 0, fontSize: "clamp(26px, 3.6vw, 38px)", fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{title}</h3>
      {children ? <div style={{ marginTop: 18, display: "grid", justifyItems: "center", gap: 12, maxWidth: 560 }}>{children}</div> : null}
    </section>
  );
}
