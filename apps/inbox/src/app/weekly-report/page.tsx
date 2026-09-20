import { getPreferences, listAllThreads } from "@/lib/store";
import { summarizeWeek } from "@/lib/weekly-report";
import { isSlackConfigured } from "@/lib/slack";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function WeeklyReportPage() {
  const prefs = await getPreferences();
  const threads = await listAllThreads();
  const report = summarizeWeek(threads, { vipSenders: prefs.vipSenders });
  const slackOn = isSlackConfigured();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Weekly report</h1>
        <p className="text-sm text-muted-foreground">
          {fmtDate(report.periodStart)} – {fmtDate(report.periodEnd)}
          {slackOn ? " · posted to Slack every Monday" : " · connect Slack in Settings to auto-post this weekly"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase">Hours saved</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{report.hoursSaved}h</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase">Threads handled</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{report.threadsHandled}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase">Spam blocked</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{report.spamBlocked}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase">Sent to Leads</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{report.handedOffToLeads}</p>
        </div>
      </div>

      <div className="glass-panel mb-6 rounded-xl p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">This week</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>{report.autoHandled} threads auto-handled without HITL review</li>
          <li>
            {report.medianReplyAgeMin != null
              ? `${Math.round(report.medianReplyAgeMin)}m median age on open threads`
              : "No open threads to measure"}
          </li>
          <li>
            {report.breachCount > 0
              ? `${report.breachCount} SLA breaches — see /sla for detail`
              : "No SLA breaches"}
          </li>
        </ul>
      </div>

      {report.topSenders.length > 0 ? (
        <div className="glass-panel rounded-xl p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Top senders this week</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {report.topSenders.map((s) => (
              <li key={s.email} className="flex justify-between">
                <span>{s.email}</span>
                <span className="text-foreground">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
