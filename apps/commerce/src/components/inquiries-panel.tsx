"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { StoredInquiry } from "@helix/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const SENTIMENT_STYLES: Record<StoredInquiry["sentiment"], string> = {
  positive: "text-primary",
  neutral: "text-muted-foreground",
  negative: "text-rose-400",
};

export function InquiriesPanel() {
  const [inquiries, setInquiries] = useState<StoredInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ customerEmail: "", inquiryText: "" });

  async function refresh() {
    const res = await fetch("/api/inquiries");
    const data = (await res.json()) as { inquiries: StoredInquiry[] };
    setInquiries(data.inquiries);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function resolve(id: string) {
    const res = await fetch(`/api/inquiries/${id}/resolve`, { method: "POST" });
    const data = (await res.json()) as { inquiry?: StoredInquiry };
    if (data.inquiry) {
      setInquiries((prev) => prev.map((i) => (i.id === id ? data.inquiry! : i)));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/inquiries/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ customerEmail: "", inquiryText: "" });
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Customer inquiries</CardTitle>
          <CardDescription>
            Classified and drafted by AI. Complaints and negative refund requests require a human.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {inquiries.map((inquiry) => (
            <div key={inquiry.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{inquiry.customerEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeDate(inquiry.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">{inquiry.inquiryType.replace("_", " ")}</Badge>
                  <span className={cn("text-xs", SENTIMENT_STYLES[inquiry.sentiment])}>
                    {inquiry.sentiment}
                  </span>
                  {inquiry.requiresHuman ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                      Needs human
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{inquiry.inquiryText}</p>
              <div className="rounded-lg bg-muted/40 p-2 text-sm">
                <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
                  AI draft reply
                </p>
                {inquiry.aiResponse}
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="w-fit">
                  {inquiry.status}
                </Badge>
                {inquiry.status === "pending" ? (
                  <Button size="sm" variant="ghost" onClick={() => void resolve(inquiry.id)}>
                    Mark resolved
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && inquiries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No inquiries yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-primary" />
            New inquiry
          </CardTitle>
          <CardDescription>JSON POST to /api/inquiries/ingest</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
            <div className="flex flex-col gap-1">
              <Label>Customer email</Label>
              <Input
                required
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Message</Label>
              <Textarea
                required
                value={form.inquiryText}
                onChange={(e) => setForm({ ...form, inquiryText: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Classifying…" : "Classify inquiry"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
