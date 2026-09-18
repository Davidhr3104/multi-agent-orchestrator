# Commerce Help walkthrough — drop-in replace

**Keep this folder’s current prod file.** Do not delete or hide `helix-commerce-howto.mp4` until the replacement is on disk.

| Slot | Path |
| --- | --- |
| Disk | `apps/commerce/public/help/helix-commerce-howto.mp4` |
| URL | `/help/helix-commerce-howto.mp4` |
| Player | `/help` via `HOW_TO_USE_COMMERCE.videoSrc` (`COMMERCE_HOWTO_VIDEO` in `@helix/help`) |

## When Helix-Personal delivers the new mp4 (Refund & Cancel)

1. Overwrite **this same filename** (`helix-commerce-howto.mp4`). Do not add a second video or rename the route.
2. `ffprobe` the new file and set `HOW_TO_USE_COMMERCE.videoTitle` to the real duration.
3. Drop or rewrite `videoNote` once the recording matches the live seed / Refund & Cancel flow.
4. Leave the `<video>` player on `/help` visible.

Current prod duration (do not treat as the re-record): **101.8s / 1m 42s**.
