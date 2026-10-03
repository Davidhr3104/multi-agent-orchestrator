import Link from "next/link";
import { DeskAction } from "@/components/desk-actions";
import { TeamControls } from "@/components/team-controls";
import { ROLE_LABEL } from "@/lib/access";
import { formatSlot } from "@/lib/format";
import { listMembers, listPosts, shellSession } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [members, session, posts] = await Promise.all([listMembers(), shellSession(), listPosts()]);
  const approvals = posts.filter((post) => post.approvedAt).sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""));
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Team</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          People on this workspace, and the limits of the current plan. Owners change the plan and webhooks. Managers run the desk. Creators draft.           Clients give the second sign-off when that path is on.{" "}
          <Link href="/client" className="font-semibold text-primary">
            Open client review
          </Link>{" "}
          on this desk. It is not a public link.
        </p>
        <div className="mt-3">
          <DeskAction action="review-link" label="Open score-100 review link" message="Review link ready." />
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-5">
        <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-3">
          {members.map((member) => {
            const here = member.name === "You" && member.role === session.role;
            return (
              <li key={member.id} className="rounded-xl border border-border bg-card/80 p-4">
                <div className="flex items-center gap-3">
                  <span className="relative grid size-12 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
                    {member.name.slice(0, 1)}
                    <span className={`absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-card ${here ? "bg-emerald-400" : "bg-slate-500"}`} title={here ? "On this desk" : "Not in this session"} />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[member.role]}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{here ? "This is the signed-in session." : "Roster only. Not a live account."}</p>
              </li>
            );
          })}
        </ul>
        <section className="rounded-xl border border-border bg-card/80 p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Recent sign-offs</h2>
          <p className="mt-1 text-xs text-muted-foreground">Approvals recorded on this workspace. Not a presence feed.</p>
          {approvals.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No sign-offs yet.</p>
          ) : (
            <ol className="mt-4 space-y-3 border-l border-border pl-4">
              {approvals.slice(0, 6).map((post) => (
                <li key={post.id} className="text-xs">
                  <p className="font-semibold text-foreground">{post.approvedBy}</p>
                  <p className="text-muted-foreground">{post.approvedAt ? formatSlot(post.approvedAt) : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <TeamControls session={session} />
    </>
  );
}
