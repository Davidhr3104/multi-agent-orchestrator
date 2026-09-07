"""Generate OmniVoice for Helix for Legal 60s howto (scene-aligned)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from omnivoice import OmniVoice

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "voice"
OUT.mkdir(parents=True, exist_ok=True)

SEGMENTS = [
    {
        "id": "01",
        "start": 0.0,
        "max_s": 4.8,
        "text": (
            "Welcome to Hee-lix for Legal. "
            "Win more R.F.P.s. Spend less time writing."
        ),
    },
    {
        "id": "02",
        "start": 5.0,
        "max_s": 6.7,
        "text": (
            "Upload any R.F.P. document. "
            "Drop it into the desk and Hee-lix starts the intake."
        ),
    },
    {
        "id": "03",
        "start": 12.0,
        "max_s": 7.7,
        "text": (
            "The multi-agent pipeline runs. "
            "Extractor, fact-checker, recommender, and reviewer — in sequence."
        ),
    },
    {
        "id": "04",
        "start": 20.0,
        "max_s": 9.7,
        "text": (
            "Instant compliance and fit. "
            "Compliance ninety-four percent. Match eighty-seven percent. "
            "Deadline: twenty twenty-six, September eighteenth."
        ),
    },
    {
        "id": "05",
        "start": 30.0,
        "max_s": 9.7,
        "text": (
            "Generate a draft proposal in minutes. "
            "Executive summary, methodology, and pricing — ready for partner review."
        ),
    },
    {
        "id": "06",
        "start": 40.0,
        "max_s": 7.7,
        "text": (
            "Automatic conflict detection. "
            "Plaintiff, defendant, and jurisdiction clear before you commit."
        ),
    },
    {
        "id": "07",
        "start": 48.0,
        "max_s": 6.7,
        "text": (
            "Convert to a matter with one confirm. "
            "Matter number twenty twenty-six dash zero one four two — logged and ready."
        ),
    },
    {
        "id": "08",
        "start": 55.0,
        "max_s": 4.7,
        "text": (
            "That is Hee-lix for Legal. "
            "R.F.P. intelligence for modern law firms."
        ),
    },
]

INSTRUCT = "male, middle-aged, low pitch, american accent"


def fade_trim(audio: np.ndarray, max_samples: int, sr: int = 24000) -> np.ndarray:
    if len(audio) <= max_samples:
        return audio
    trimmed = audio[:max_samples].copy()
    fade = int(0.1 * sr)
    if fade > 0 and len(trimmed) > fade:
        ramp = np.linspace(1.0, 0.0, fade, dtype=trimmed.dtype)
        trimmed[-fade:] *= ramp
    return trimmed


def main() -> None:
    print("Loading OmniVoice (CPU)…", flush=True)
    model = OmniVoice.from_pretrained(
        "k2-fsa/OmniVoice",
        device_map="cpu",
        dtype=torch.float32,
    )
    meta = {
        "provider": "omnivoice",
        "instruct": INSTRUCT,
        "style": "Legal partner scene-aligned 60s",
        "sample_rate": 24000,
        "voices": [],
    }
    for seg in SEGMENTS:
        out_path = OUT / f"{seg['id']}.wav"
        speed = 1.08
        duration = 0.0
        for attempt in range(4):
            print(f"Gen {seg['id']} speed={speed:.2f}", flush=True)
            audio = model.generate(
                text=seg["text"],
                instruct=INSTRUCT,
                num_step=16,
                speed=speed,
            )
            arr = np.asarray(audio[0], dtype=np.float32)
            duration = float(len(arr) / 24000)
            print(f"  duration={duration:.2f}s (max {seg['max_s']})", flush=True)
            if duration <= seg["max_s"] or attempt == 3:
                if duration > seg["max_s"]:
                    arr = fade_trim(arr, int(seg["max_s"] * 24000))
                    duration = float(len(arr) / 24000)
                    print(f"  trimmed to {duration:.2f}s", flush=True)
                sf.write(out_path, arr, 24000)
                break
            if duration < seg["max_s"] * 0.72 and speed > 0.95:
                speed = max(0.95, speed - 0.05)
            else:
                speed = min(1.28, speed + 0.07)

        meta["voices"].append(
            {
                "id": seg["id"],
                "path": f"assets/voice/{seg['id']}.wav",
                "start": seg["start"],
                "duration_s": round(duration, 3),
                "max_s": seg["max_s"],
                "text": seg["text"],
            }
        )
    meta_path = ROOT / "audio_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote {meta_path}", flush=True)


if __name__ == "__main__":
    main()
