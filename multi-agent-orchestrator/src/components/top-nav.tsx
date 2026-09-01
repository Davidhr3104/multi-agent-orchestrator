import Link from "next/link";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export type NavKey = "dashboard" | "workflows" | "agents" | "logs";

const NAV_ITEMS: { href: string; label: string; key: NavKey }[] = [
  { href: "/", label: "Dashboard", key: "dashboard" },
  { href: "/workflows", label: "Workflows", key: "workflows" },
  { href: "/agents", label: "Agents", key: "agents" },
  { href: "/logs", label: "Logs", key: "logs" },
];

export function TopNav({
  active,
  pulse = "ok",
  actions,
}: {
  active: NavKey;
  pulse?: "busy" | "ok";
  actions?: React.ReactNode;
}) {
  return (
    <nav className="border-outline-variant/30 bg-surface/80 fixed top-0 z-50 w-full border-b shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-primary flex items-center text-[24px] font-bold leading-8 drop-shadow-[0_0_8px_rgba(76,215,246,0.15)]">
            <Icon name="hub" filled className="mr-2 text-[24px]" />
            HX
          </span>
          <div className="bg-outline-variant mx-2 h-4 w-px" />
          <span className="text-on-surface text-[16px] font-medium">
            Helix Orchestrator
          </span>
          <span className="relative ml-2 flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                pulse === "busy" ? "animate-ping bg-primary" : "bg-tertiary"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                pulse === "busy" ? "bg-primary" : "bg-tertiary"
              )}
            />
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "font-label-sm border-b-2 pb-1 text-[12px] uppercase tracking-wider transition-colors",
                active === item.key
                  ? "text-primary border-primary"
                  : "text-on-surface-variant hover:text-primary border-transparent"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Icon
            name="notifications"
            className="text-on-surface-variant hidden text-[20px] sm:inline"
          />
          <div className="bg-outline-variant mx-1 hidden h-6 w-px sm:block" />
          {actions}
        </div>
      </div>
    </nav>
  );
}
