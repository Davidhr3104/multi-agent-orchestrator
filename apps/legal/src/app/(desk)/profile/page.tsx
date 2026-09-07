"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-7 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Profile</h1>
        <p className="mt-1 text-sm text-slate-400">Operator identity on this Helix for Legal desk.</p>
      </div>

      <Card>
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex size-14 items-center justify-center rounded-full border-2 border-gold-500 bg-navy-900 text-lg font-semibold text-gold-300">
                D
              </div>
              <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-navy-900 bg-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-white">Deveku</CardTitle>
              <CardDescription>Operations · Helix for Legal</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] tracking-wide text-slate-500 uppercase">Role</dt>
              <dd className="mt-0.5 text-slate-200">Operations</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-slate-500 uppercase">Workspace</dt>
              <dd className="mt-0.5 text-slate-200">RFP Intelligence</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-slate-500 uppercase">Seat</dt>
              <dd className="mt-0.5">
                <Badge variant="outline" className="border-gold-500/40 text-gold-400">
                  Enterprise
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-slate-500 uppercase">Session</dt>
              <dd className="mt-0.5 text-emerald-400">Active on this origin</dd>
            </div>
          </dl>
          <Separator />
          <p className="text-xs text-slate-400">
            Firm scoring profile and practice areas live in Settings. Audit trail is a separate log.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
              Open settings
            </Link>
            <Link href="/audit" className={buttonVariants({ variant: "outline" })}>
              Audit log
            </Link>
            <Link href="/notifications" className={buttonVariants({ variant: "outline" })}>
              Notifications
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
