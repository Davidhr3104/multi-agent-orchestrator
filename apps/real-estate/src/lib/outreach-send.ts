import { CHANNEL_LABEL, channelReady, isChannel, sendEmailResend, sendTwilio, type SendResult } from "./messaging";
import { getDraft, getLead, logActivity, putDraft, setLeadLastContact } from "./store";
import type { Delivery } from "./types";

export type SendReply = { status: number; body: Record<string, unknown> };

/**
 * Sends one approved draft on one channel. The agent must have approved the draft AND confirmed this specific send
 * (confirm: true); a draft is never sent by the risk policy, the chat or the nightly run. "sent" is reported only
 * when Resend or Twilio answered with a message id.
 */
export async function sendApprovedDraft(input: { draftId: string; channel: unknown; confirm: unknown; actor: string; fetchImpl?: typeof fetch }): Promise<SendReply> {
  if (input.confirm !== true) return { status: 400, body: { sent: false, error: "Sending needs your explicit confirmation for this draft." } };
  if (!isChannel(input.channel)) return { status: 400, body: { sent: false, error: "channel must be email, sms or whatsapp." } };
  const channel = input.channel;
  const draft = await getDraft(input.draftId);
  if (!draft) return { status: 404, body: { sent: false, error: "Draft not found." } };
  if (draft.status !== "approved") return { status: 409, body: { sent: false, error: "Approve the draft before sending it." } };
  const lead = await getLead(draft.leadId);
  if (!lead) return { status: 404, body: { sent: false, error: "The buyer for this draft is no longer on the desk." } };
  const previous = draft.deliveries?.find((d) => d.channel === channel);
  if (previous) return { status: 409, body: { sent: false, error: `Already sent by ${CHANNEL_LABEL[channel]} to ${previous.to}.` } };
  const to = channel === "email" ? lead.email : lead.phone;
  if (!to) return { status: 409, body: { sent: false, error: `${lead.name} has no ${channel === "email" ? "email" : "phone number"} on file.` } };
  if (!channelReady(channel)) {
    return { status: 409, body: { sent: false, notConfigured: true, error: `Not sent — ${CHANNEL_LABEL[channel]} isn't connected on this server. Copy the message into your own ${channel === "email" ? "inbox" : "phone"}.` } };
  }

  const result: SendResult =
    channel === "email" ? await sendEmailResend({ to, subject: draft.subject, text: draft.body }, input.fetchImpl) : await sendTwilio({ to, body: draft.body, channel }, input.fetchImpl);
  if (!result.ok) {
    await logActivity({ actor: input.actor, action: `send_${channel}`, kind: "run", via: "button", labels: [`${lead.name}: ${draft.subject}`], done: 0, failed: 1 });
    return { status: 502, body: { sent: false, error: `Not sent — ${result.error}` } };
  }
  const at = new Date().toISOString();
  const delivery: Delivery = { channel, provider: result.provider, providerId: result.providerId, to, at, by: input.actor };
  await putDraft({ ...draft, deliveries: [...(draft.deliveries ?? []), delivery] });
  await setLeadLastContact(lead.id, at);
  await logActivity({ actor: input.actor, action: `send_${channel}`, kind: "run", via: "button", labels: [`${lead.name}: ${draft.subject}`], done: 1, failed: 0 });
  return { status: 200, body: { sent: true, channel, provider: result.provider, providerId: result.providerId, to, at } };
}
