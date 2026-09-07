import type { InquiryClassificationResult, InquiryInput, InquiryType, Sentiment } from "./types";

const DISPUTE_RE = /\b(dispute|chargeback|report.{0,10}bank|lawyer|legal action|bbb|sue)\b/i;
const COMPLAINT_RE = /\b(unhappy|terrible|worst|angry|furious|disgusted|unacceptable)\b/i;
const REFUND_RE = /\b(refund|return|money back|broken|defective|damaged|wrong item)\b/i;
const SHIPPING_RE = /\b(shipping|delivery|lost package|never arrived|tracking)\b/i;
const STATUS_RE = /\b(where is my order|order status|track my order|has my order shipped)\b/i;
const NEGATIVE_RE = /\b(terrible|awful|worst|angry|furious|broken|defective|unacceptable|disappointed|unhappy)\b/i;
const POSITIVE_RE = /\b(thanks|thank you|great|love|awesome|amazing|perfect)\b/i;

function detectType(text: string): InquiryType {
  if (DISPUTE_RE.test(text)) return "complaint";
  if (REFUND_RE.test(text)) return "return_refund";
  if (COMPLAINT_RE.test(text)) return "complaint";
  if (STATUS_RE.test(text)) return "order_status";
  if (SHIPPING_RE.test(text)) return "shipping_issue";
  if (/\b(size|color|material|fit|does (it|this) come|question about)\b/i.test(text)) {
    return "product_question";
  }
  if (/\?/.test(text)) return "product_question";
  return "other";
}

function detectSentiment(text: string): Sentiment {
  if (NEGATIVE_RE.test(text)) return "negative";
  if (POSITIVE_RE.test(text)) return "positive";
  return "neutral";
}

function draftResponse(type: InquiryType): string {
  switch (type) {
    case "order_status":
      return "Thanks for reaching out — we're looking up your order status now and will confirm shipping details shortly.";
    case "return_refund":
      return "We're sorry to hear that. A team member will review your return/refund request and follow up with next steps.";
    case "shipping_issue":
      return "Thanks for flagging this — we're checking the carrier tracking details and will update you shortly.";
    case "product_question":
      return "Thanks for your question — here are the product details we have on file. Let us know if you need anything else.";
    case "complaint":
      return "We're sorry for the experience. This has been escalated to a human agent for immediate follow-up.";
    default:
      return "Thanks for reaching out — a team member will review your message shortly.";
  }
}

export function classifyInquiryHeuristic(input: InquiryInput): InquiryClassificationResult {
  const text = input.inquiryText;
  const inquiryType = detectType(text);
  const sentiment = detectSentiment(text);

  const requiresHuman =
    inquiryType === "complaint" ||
    (inquiryType === "return_refund" && sentiment === "negative") ||
    DISPUTE_RE.test(text);

  return {
    inquiryType,
    sentiment,
    aiResponse: draftResponse(inquiryType),
    requiresHuman,
    engine: "heuristic",
    demoMode: true,
  };
}
