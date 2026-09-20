import Link from "next/link";
import { HOW_TO_USE_LEADS } from "@helix/help";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpPage() {
  const guide = HOW_TO_USE_LEADS;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">{guide.product}</p>
          <h1 className="mt-1 text-2xl font-medium">{guide.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{guide.overview}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem]"
        >
          Inbox
        </Link>
      </div>
      <ol className="flex flex-col gap-3">
        {guide.steps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-base">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
          </Card>
        ))}
      </ol>
      <p className="text-sm text-amber-200">{guide.hitlTip}</p>
    </div>
  );
}
