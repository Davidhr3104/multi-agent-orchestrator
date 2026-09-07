/**
 * Captions aligned to Legal VO (audio_meta durations).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Caption } from "@remotion/captions";

const clips: { start: number; duration: number; text: string }[] = [
  { start: 0.0, duration: 3.83, text: "Welcome to Helix for Legal. Win more RFPs. Spend less time writing." },
  { start: 5.0, duration: 4.23, text: "Upload any RFP document. Drop it into the desk and Helix starts the intake." },
  { start: 12.0, duration: 5.27, text: "The multi-agent pipeline runs. Extractor, fact-checker, recommender, and reviewer." },
  { start: 20.0, duration: 8.2, text: "Compliance ninety-four percent. Match eighty-seven percent. Deadline twenty twenty-six September eighteenth." },
  { start: 30.0, duration: 5.79, text: "Generate a draft proposal. Executive summary, methodology, and pricing." },
  { start: 40.0, duration: 5.37, text: "Automatic conflict detection. Plaintiff, defendant, and jurisdiction clear." },
  { start: 48.0, duration: 6.09, text: "Convert to a matter. Matter twenty twenty-six dash zero one four two." },
  { start: 55.0, duration: 3.85, text: "Helix for Legal. RFP intelligence for modern law firms." },
];

function tokenize(text: string): string[] {
  return text.match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?|[.,!?:;—]/g) ?? [];
}

const captions: Caption[] = [];
for (const clip of clips) {
  const tokens = tokenize(clip.text);
  if (!tokens.length) continue;
  const lead = 0.1;
  const usable = Math.max(0.4, clip.duration - lead - 0.2);
  const slot = usable / tokens.length;
  tokens.forEach((tok, i) => {
    const startMs = Math.round((clip.start + lead + i * slot) * 1000);
    const endMs = Math.round((clip.start + lead + (i + 1) * slot) * 1000);
    const spaced =
      /^[.,!?:;]$/.test(tok) ? tok : captions.length === 0 ? tok : ` ${tok}`;
    captions.push({
      text: spaced,
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: null,
    });
  });
}

writeFileSync(
  join(process.cwd(), "public", "legal-captions.json"),
  JSON.stringify(captions, null, 2),
);
console.log(`Wrote ${captions.length} captions`);
