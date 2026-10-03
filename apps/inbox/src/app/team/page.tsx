"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Avatar, ChartCard, Donut } from "@helix/ui";
import { IllustratedEmpty, PageFrame, VIOLET } from "@/components/desk-kit";

type Role = "admin" | "ea" | "reader";
type Member = { id: string; name: string; email: string; role: Role };

const KEY = "helix-inbox-team";
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", ea: "Executive assistant", reader: "Reader" };
const ROLE_COLOR: Record<Role, string> = { admin: VIOLET, ea: "#38bdf8", reader: "#64748b" };
const FIELD = "min-h-10 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm md:min-h-9";

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ea");

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Member[];
      setMembers(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMembers([]);
    }
  }, []);

  function persist(next: Member[]) {
    setMembers(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  const byRole = useMemo(
    () =>
      (Object.keys(ROLE_LABEL) as Role[])
        .map((r) => ({ label: ROLE_LABEL[r], value: members.filter((m) => m.role === r).length, color: ROLE_COLOR[r] }))
        .filter((s) => s.value > 0),
    [members]
  );

  return (
    <PageFrame title="Team & roles" subtitle="Admin can change rules and keys. EA works the queue. Reader can open reports. This roster is stored on this browser only.">
      <form
        className="glass-panel grid min-w-0 gap-2 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]"
        aria-label="Add a team member"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !email.trim()) return;
          persist([...members, { id: `m-${Date.now()}`, name: name.trim(), email: email.trim(), role }]);
          setName("");
          setEmail("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className={FIELD} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" type="email" className={FIELD} />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role" className={FIELD}>
          <option value="admin">Admin</option>
          <option value="ea">Executive assistant</option>
          <option value="reader">Reader</option>
        </select>
        <button type="submit" className="min-h-10 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white md:min-h-9">
          Add
        </button>
      </form>

      {members.length === 0 ? (
        <IllustratedEmpty
          title="Just you for now"
          body="Add the people who work this desk and give each a role. The roster stays on this browser, so nothing here is shared or synced yet."
          icon={<Users className="size-7" aria-hidden />}
          colors={["#2e1065", "#1d4ed8"]}
          exampleLabel="What a member looks like"
          example={
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name="Sarah Kim" size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">Sarah Kim</p>
                <p className="truncate text-xs text-muted-foreground">sarah@example.com</p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Executive assistant</span>
            </div>
          }
        />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ul className="glass-panel min-w-0 divide-y divide-border rounded-xl">
            {members.map((member) => (
              <li key={member.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={member.name} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <select
                    value={member.role}
                    aria-label={`Role for ${member.name}`}
                    onChange={(e) => persist(members.map((row) => (row.id === member.id ? { ...row, role: e.target.value as Role } : row)))}
                    className="min-h-10 rounded border border-border bg-transparent px-2 py-1 text-xs md:min-h-8"
                  >
                    <option value="admin">Admin</option>
                    <option value="ea">EA</option>
                    <option value="reader">Reader</option>
                  </select>
                  <button type="button" className="min-h-10 px-2 text-xs text-red-500 md:min-h-8" aria-label={`Remove ${member.name}`} onClick={() => persist(members.filter((row) => row.id !== member.id))}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <ChartCard title="Roles" subtitle="Who can do what" source="Counted from this browser's roster">
            <Donut centerValue={members.length} centerLabel="people" ariaLabel="Team members by role" slices={byRole} />
          </ChartCard>
        </div>
      )}
    </PageFrame>
  );
}
