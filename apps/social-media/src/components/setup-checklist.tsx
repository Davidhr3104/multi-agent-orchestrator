import Link from "next/link";
import { connectionReport } from "@/lib/connections";
import { getBrand, listPosts } from "@/lib/store";

/** Setup progress from facts already on the desk. Connecting an account stays incomplete until a token env is set. */
export async function SetupChecklist() {
  const [posts, brand] = await Promise.all([listPosts(), getBrand()]);
  const connected = connectionReport().channels.some((row) => row.tokenState === "set");
  const steps = [
    { done: connected, label: "Connect an account", href: "/connections" },
    { done: brand.voice.length > 0, label: "Brand voice", href: "/brand" },
    { done: posts.length > 0, label: "First post", href: "/posts" },
  ];
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="Setup checklist">
      <p className="font-medium text-muted-foreground">Setup {done}/{steps.length}</p>
      <ol className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={step.href} className={step.done ? "text-muted-foreground line-through" : "font-medium text-foreground underline-offset-2 hover:underline"}>
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
