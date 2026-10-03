import Link from "next/link";
import { cachedInsights, metaConnected } from "@/lib/social/insights";
import { getBrand, listPosts } from "@/lib/store";

/** Setup progress from facts already on the desk. Connecting an account stays incomplete until Meta answered a real read. */
export async function SetupChecklist() {
  const [posts, brand] = await Promise.all([listPosts(), getBrand()]);
  const meta = metaConnected(cachedInsights());
  const connected = meta.instagram || meta.facebook;
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
