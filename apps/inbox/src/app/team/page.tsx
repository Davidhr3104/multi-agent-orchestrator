"use client";

import { useEffect, useState } from "react";

type Role = "admin" | "ea" | "reader";
type Member = { id: string; name: string; email: string; role: Role };

const KEY = "helix-inbox-team";

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

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-foreground">Team & roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Admin can change rules and keys. EA works the queue. Reader can open reports. This roster is stored on this browser.
      </p>
      <form
        className="mt-6 grid gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !email.trim()) return;
          persist([...members, { id: `m-${Date.now()}`, name: name.trim(), email: email.trim(), role }]);
          setName("");
          setEmail("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm">
          <option value="admin">Admin</option>
          <option value="ea">Executive assistant</option>
          <option value="reader">Reader</option>
        </select>
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">
          Add
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>
              {member.name} · {member.email}
            </span>
            <span className="flex items-center gap-3">
              <select
                value={member.role}
                onChange={(e) => persist(members.map((row) => (row.id === member.id ? { ...row, role: e.target.value as Role } : row)))}
                className="rounded border border-border bg-transparent px-2 py-1 text-xs"
              >
                <option value="admin">Admin</option>
                <option value="ea">EA</option>
                <option value="reader">Reader</option>
              </select>
              <button type="button" className="text-xs text-red-500" onClick={() => persist(members.filter((row) => row.id !== member.id))}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
