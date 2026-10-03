import { RealDataActions } from "@/components/real-data-actions";
import { aiUsageTotals, claudeConfigured, EST_INPUT_USD_PER_MTOK, EST_OUTPUT_USD_PER_MTOK } from "@/lib/social/claude";
import { metaConfig } from "@/lib/social/config";
import { currentInsights, metaConnected, realAccounts, realPosts } from "@/lib/social/insights";
import type { NetworkRead } from "@/lib/social/meta-graph";
import { rankPosts, topPosts } from "@/lib/social/performance";
import { listWeeklyReports } from "@/lib/social/weekly-report";

const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("en-US"));
const rate = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const card = "rounded-xl border border-border bg-card/80 p-5";

function readError(label: string, read: NetworkRead) {
  return read.ok ? null : (
    <li key={label}>
      {label}: {read.error}
    </li>
  );
}

/** Real results from Meta, labelled as such. Never mixed with planned posts or demo seeds. */
export async function RealDataPanel() {
  const cfg = metaConfig();
  const usage = aiUsageTotals();
  const claude = claudeConfigured();
  const usageCard = (
    <article className={card}>
      <h3 className="text-sm font-semibold text-foreground">AI cost (estimated)</h3>
      <p className="mt-2 font-mono text-2xl text-foreground">${usage.estUsd.toFixed(4)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {usage.calls} Claude calls · {usage.inputTokens.toLocaleString("en-US")} input + {usage.outputTokens.toLocaleString("en-US")} output tokens on this server since it started.
        Estimated at ${EST_INPUT_USD_PER_MTOK}/M input and ${EST_OUTPUT_USD_PER_MTOK}/M output tokens (list price), not read from a bill.
      </p>
    </article>
  );

  if (!cfg) {
    return (
      <section className="grid gap-4 lg:grid-cols-3" aria-labelledby="real-heading">
        <article className={`${card} lg:col-span-2`}>
          <h2 id="real-heading" className="text-lg font-semibold text-foreground">
            Real account data
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Not connected. Set <span className="font-mono text-foreground">HELIX_META_ACCESS_TOKEN</span> with <span className="font-mono text-foreground">HELIX_META_IG_USER_ID</span> and/or{" "}
            <span className="font-mono text-foreground">HELIX_META_PAGE_ID</span> to read Instagram and Facebook results. Nothing on this page is an engagement number until then.
          </p>
        </article>
        {usageCard}
      </section>
    );
  }

  const snap = await currentInsights();
  const connected = metaConnected(snap);
  const posts = realPosts(snap);
  const accounts = realAccounts(snap);
  const top = topPosts(posts, 3);
  const rows = rankPosts(posts).slice(0, 12);
  const report = listWeeklyReports()[0];
  const errors = snap ? [readError("Instagram", snap.instagram), readError("Facebook", snap.facebook)].filter(Boolean) : [];
  const warnings = snap ? [snap.instagram, snap.facebook].flatMap((r) => (r.ok ? r.warnings : [])) : [];

  return (
    <section className="space-y-4" aria-labelledby="real-heading">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="real-heading" className="text-lg font-semibold text-foreground">
            Real account data <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">Meta Graph API</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {snap ? `Read ${when(snap.fetchedAt)}.` : "Not read yet."} Instagram {connected.instagram ? "connected" : "not connected"} · Facebook {connected.facebook ? "connected" : "not connected"}.
            Rankings and totals are computed in code from these numbers. Missing metrics show as —.
          </p>
        </div>
        <RealDataActions claude={claude} />
      </header>

      {snap && !snap.verification.ok ? <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">Meta rejected the token: {snap.verification.error}</p> : null}
      {errors.length ? <ul className="list-inside list-disc text-xs text-amber-200">{errors}</ul> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {accounts.map((a) => (
          <article key={a.id} className={card}>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{a.network}</p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{a.name}</h3>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Followers</dt>
                <dd className="font-mono text-foreground">{n(a.followers)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reach {a.periodDays}d</dt>
                <dd className="font-mono text-foreground">{n(a.reach)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Interactions {a.periodDays}d</dt>
                <dd className="font-mono text-foreground">{n(a.interactions)}</dd>
              </div>
            </dl>
          </article>
        ))}
        {usageCard}
      </div>

      <article className={card}>
        <h3 className="text-sm font-semibold text-foreground">Best real posts</h3>
        <p className="mt-1 text-xs text-muted-foreground">Ranked by interactions per reached account (likes + comments + saves + shares ÷ reach); posts without reach rank by interactions. Claude drafts from these.</p>
        {top.length ? (
          <ol className="mt-3 space-y-2 text-sm">
            {top.map((p, i) => (
              <li key={p.id} className="rounded-lg bg-background/60 px-3 py-2">
                <span className="font-mono text-xs text-muted-foreground">P{i + 1} · {p.network} · {rate(p.engagementRate)} · {n(p.interactions)} interactions · reach {n(p.reach)}</span>
                <p className="mt-1 line-clamp-2 text-foreground">{p.caption || "(no caption)"}</p>
                {p.permalink ? (
                  <a href={p.permalink} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">
                    Open on {p.network}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No real post with results was returned.</p>
        )}
      </article>

      {rows.length ? (
        <article className={`${card} overflow-x-auto`}>
          <h3 className="text-sm font-semibold text-foreground">Recent posts and their metrics</h3>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                {["Date", "Network", "Caption", "Reach", "Views", "Likes", "Comments", "Saves", "Shares", "Rate"].map((h) => (
                  <th key={h} className="py-1 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-foreground">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(p.publishedAt).toLocaleDateString("en-US")}</td>
                  <td className="pr-3">{p.network}</td>
                  <td className="max-w-56 truncate pr-3 font-sans">{p.caption || "—"}</td>
                  <td className="pr-3">{n(p.reach)}</td>
                  <td className="pr-3">{n(p.views)}</td>
                  <td className="pr-3">{n(p.likes)}</td>
                  <td className="pr-3">{n(p.comments)}</td>
                  <td className="pr-3">{n(p.saves)}</td>
                  <td className="pr-3">{n(p.shares)}</td>
                  <td className="pr-3">{rate(p.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      <article className={card}>
        <h3 className="text-sm font-semibold text-foreground">Weekly report</h3>
        {report ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {when(report.createdAt)} · {report.engine === "claude" ? "Prose by Claude" : "Computed facts only"} · {report.note}
            </p>
            <div className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground">{report.prose}</div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Numbers computed in code</summary>
              <ul className="mt-2 space-y-1">
                {report.facts.map((f) => (
                  <li key={f.label}>
                    {f.label}: <span className="font-mono text-foreground">{f.value}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No weekly report yet. The Monday cron writes one, or press Write weekly report.</p>
        )}
      </article>

      {warnings.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{warnings.length} metrics Meta did not return</summary>
          <ul className="mt-2 list-inside list-disc">
            {warnings.slice(0, 20).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
