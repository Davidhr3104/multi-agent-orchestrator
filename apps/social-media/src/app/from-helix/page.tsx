import Link from "next/link";
import { SOURCE_LABEL } from "@/lib/helix-inbound";
import { channelLabel } from "@/lib/format";
import { listAudienceComments, listInbound, listPosts } from "@/lib/store";
import { InboundActions } from "@/components/inbound-actions";
import { ChannelBadge } from "@/components/bits";

export const dynamic = "force-dynamic";

export default async function FromHelixPage() {
  const [inbound, comments, posts] = await Promise.all([listInbound(), listAudienceComments(), listPosts()]);
  const waiting = inbound.filter((row) => row.status === "waiting");
  const leads = comments.filter((row) => row.kind === "lead");

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">From other Helixes</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These rows are labeled invented demo. Other Helix apps do not POST drafts here yet. A person on this desk still approves and presses Publish; nothing goes out on its own.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Drafts waiting ({waiting.length})</h2>
        {waiting.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is waiting from another desk.</p> : null}
        <ul className="grid gap-3">
          {inbound.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-card/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ChannelBadge channel={row.channel} />
                <span className="text-xs font-semibold text-muted-foreground">{SOURCE_LABEL[row.source]}</span>
                {row.demo ? <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">Invented demo</span> : null}
                <span className="text-xs capitalize text-muted-foreground">{row.status}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{row.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{row.caption}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{row.cite}</p>
              {row.status === "waiting" ? <InboundActions id={row.id} /> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Interested comments → Leads ({leads.length})</h2>
        <p className="text-sm text-muted-foreground">
          Comments are classified on this desk. Nothing is posted to Helix for Leads yet — there is no live handoff. Unsure or sensitive comments wait. Complaints stay off the sales desk.
        </p>
        <ul className="grid gap-2">
          {comments.map((row) => {
            const post = posts.find((p) => p.id === row.postId);
            return (
              <li key={row.id} className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm">
                <p className="text-foreground">&ldquo;{row.text}&rdquo;</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.kind}
                  {post ? (
                    <>
                      {" · "}
                      <Link className="underline" href={`/posts/${post.id}`}>
                        {channelLabel(post.channel)} post
                      </Link>
                    </>
                  ) : null}
                  {row.demo ? " · invented demo" : ""}
                  {row.handedToLeads ? " · handed to Leads" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
