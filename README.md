# Afterimage

A listen-only, audio-reactive visual deck for DJs playing EDM, tech house, dubstep and trance. It listens
to an input device, drives fullscreen WebGL2 visuals from the music, recognizes tracks you enrolled, and
switches to each track's saved look.

- Listen-only. Inputs are never played back. Echo cancellation, noise suppression and auto gain are turned off
  so the analysis sees the raw signal.
- Ten scenes and twelve palettes, driven by four band levels, a kick envelope, BPM and a section guess
  (groove, breakdown, build, drop).
- Your own images and videos are stored in the browser (IndexedDB) and layered on any look.
- Track recognition runs on your machine. You enroll your own files; only landmark hashes are kept, not audio.
- An optional AI director (OpenRouter) suggests looks from a vibe prompt or a track's stats. A local keyword
  heuristic is used when there is no key or the request fails.
- Manual control always wins. Touching the look pauses auto cues until you resume them.

## Quick start

Developed on Node 22 and [pnpm](https://pnpm.io) 10. You do not need Rust to run the app: the compiled
WebAssembly is committed.

```bash
pnpm install
cp .env.example .env.local
pnpm dev -p 4617 -H 127.0.0.1
```

Open http://127.0.0.1:4617 and press **Run built-in demo** to see it move without any hardware.

`-H 127.0.0.1` keeps the dev server off your network. `/api/look` spends your OpenRouter key for any caller
that can reach it, and it has no authentication or rate limit, so do not expose it publicly as it is.

Audio input needs a secure context. `localhost` and `127.0.0.1` count as secure.

## Using the deck

The panel has three tabs. Keys: `1`-`9` and `0` pick a scene, `A` toggles auto cues, `H` hides the panel, `F`
toggles fullscreen. Keys are ignored while you type in a field.

| Key | Scene | What it looks like |
|---|---|---|
| `1` | Portal | A tunnel that opens up in breakdowns |
| `2` | Grid | A perspective grid corridor |
| `3` | Strobe | Concentric geometry. Its flashing bars need the strobe switch and the strobe master |
| `4` | Rift | Glitching slices pushed around by the bass |
| `5` | Media | Your own image or video full-frame. It shows the portal until you add media |
| `6` | Bars | Mirrored equalizer columns that follow the four bands |
| `7` | Aurora | Soft flowing light curtains |
| `8` | Warp | Stars streaking out from the centre |
| `9` | Lasers | Beams fanning from the top and bottom |
| `0` | Bloom | A rotating mandala that swells on the kick |

| Tab | What it does |
|---|---|
| Live | Choose the input, watch the meters, edit the look, set the strobe master, see the recognition readout, describe a vibe |
| Media | Add images and videos, rename or delete them, click one to use it in the current look |
| Tracks | Enroll tracks, edit each track's look, ask the AI for a suggestion |

Inputs: **Connect input** asks for microphone permission and lists the devices. **Play a file as input**
plays the file through your speakers, which is only meant for testing. Live inputs never reach the speakers.

Recognition flow:

1. Enroll your tracks in the Tracks tab. Each file is decoded, mixed to mono, fingerprinted in the browser and
   discarded. Tracks longer than one hour are rejected.
2. Give each track a look in its row (scene, palette, media, strobe), preview it, or ask the AI for one.
3. With **Auto cues** on, the first confirmed match applies that track's look. The scene change waits for the
   next kick, or 700 ms, whichever comes first.
4. Any manual change to the look pauses auto cues. Press **Resume auto cues** or `A` to turn them back on.

The first confirmation takes about 4 seconds: the matcher needs 3 seconds of audio, runs once per second, and
wants two consecutive agreeing windows.

## Secrets and the look service

The browser never calls OpenRouter. It posts to this app's `/api/look` route, which calls OpenRouter.

The key comes from `.env.local` (gitignored). The app has no key field, and `/api/look` ignores any key a caller
sends. Never commit a key. If a key has been pasted anywhere it should not have been, rotate it.

| Variable | Purpose | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Key used by `/api/look` | none (the local heuristic is used) |
| `OPENROUTER_MODEL` | Model used by `/api/look` | `openai/gpt-4o-mini` |

`.env.example` sets `OPENROUTER_MODEL` to another model, so copying it changes the model.

The automated tests never call OpenRouter. The e2e server starts with an empty key.

## How it works

```
input device -> AudioWorklet (capture) -> Downsampler (wasm, 11025 Hz) -> matcher worker (wasm)
             -> AnalyserNode (2048 FFT) -> Analyzer (wasm) -> frame { sub low mid air kick bpm section }
                                                           -> WebGL2 renderer + look state
```

| Layer | Language | Location |
|---|---|---|
| FFT, windowing, downsampling, fingerprinting, matcher, band levels, beat and section tracking, simulator, demo-track synthesis, WAV encoding | Rust | `crates/deck-dsp` |
| Offline tools (`demo-tracks`, `fingerprint`) | Rust | `crates/deck-cli` |
| Audio graph, decoding, matcher worker, IndexedDB, WebGL2 renderer, GLSL | TypeScript, GLSL | `src/audio`, `src/visuals`, `src/lib` |
| UI and the look route | TypeScript, React | `src/components`, `src/app` |

Fingerprinting and matching are the heavy parts. The per-frame band, beat and section code is in Rust as well,
so the browser and the native tests run a single implementation. It is not there for speed.

The fingerprint is a landmark hash: 1024-point FFT at 11025 Hz with a 256-sample hop, spectral peaks in seven
bands, each peak paired with up to five later peaks. Matching votes on the time offset between live hashes and
enrolled hashes.

Kick detection never fires twice within 240 ms, which also caps strobe flashes at about four per second.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next dev server |
| `pnpm build`, `pnpm start` | Production build and server |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright against a fresh production build |
| `pnpm build:wasm` | Rebuild `src/wasm` and `public/wasm` from the Rust crate |
| `pnpm demo:audio` | Write three deterministic demo WAVs to `demo-audio/` |

## The committed WebAssembly

`src/wasm/` and `public/wasm/deck_dsp_bg.wasm` are generated and committed so a fresh clone runs without
Rust. Rebuild them after changing `crates/deck-dsp`:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
pnpm build:wasm
```

The committed files were built with Rust 1.99.1 and wasm-pack 0.15.0. A rebuild from a clean target directory
produced a byte-identical file. After a rebuild, `git status` should show no change unless you edited the
Rust source.

When several checkouts share one cargo target directory (`CARGO_TARGET_DIR`), a rebuild can pick up another
checkout's compiled output. That happened during development: a scratch copy with a modified source left a
stale wasm in this checkout's build. Run `cargo clean` before rebuilding if you share a target directory.

## Testing

| Suite | Command | Covers |
|---|---|---|
| Rust | `cargo test --workspace` | DSP, matcher, beat guard, CLI, and `parity.rs`, which pins values captured from the original TypeScript implementation |
| Vitest | `pnpm test` | The wasm boundary, matcher worker protocol, IndexedDB, look schema and heuristic, `/api/look`, renderer look state |
| Playwright | `pnpm test:e2e` | The deck in Chromium: scenes, media, enrollment, recognition, manual override, describe a look, mobile layout, strobe rate |

Notes:

- Run the Rust tests without `--release`. The release profile sets `panic = "abort"`, and cargo then refuses to
  build the tests (`requires panic strategy abort which is incompatible with ... unwind`).
- Static checks: `cargo fmt --all --check` and `cargo clippy --workspace --all-targets -- -D warnings`, plus the
  same clippy for `-p deck-dsp --target wasm32-unknown-unknown`.
- Playwright needs a Chromium build: `pnpm exec playwright install chromium`. The config uses the full
  Chromium channel because the headless shell hung when creating a WebGL2 context on the development machine.
  The suite has only been run on an Apple silicon Mac.
- The e2e suite listens on port 4627 and builds the app first. It generates `demo-audio/` on the first run,
  which uses `cargo`, so Rust must be installed. The fake microphone plays `demo-dubstep-140.wav`.
- The e2e strobe test measures the on-screen flash rate. With the guard lowered to 60 ms it fails.

## Safety

The strobe master is off by default and the UI shows a photosensitivity warning next to it. The flashing bars
of the Strobe scene only appear when the look's own strobe switch and the master are both on. The other
kick-driven pulses in every scene are always on. All of them follow the kick detector, which never fires twice
within 240 ms, so they stay at about four per second or less. Warn your audience before turning strobe on.

## Known limits

- Validation used synthetic tracks and generated audio. Nothing has been tuned on real music through a real
  room, speakers or an audio interface.
- Recognition thresholds are untuned for real recordings: minimum score 8, dominance 1.4 over the runner-up,
  two consecutive windows, a 6 second window, a 3 second minimum. They live in
  `crates/deck-dsp/src/matcher.rs`.
- The beat tracker keeps a history of 60 frames, so its window depends on the display refresh rate.
- The matcher receives the whole library again whenever the set of enrolled tracks changes.
- Audio is mixed to mono. Tracks longer than one hour cannot be enrolled.
- Chromium on macOS exposed only the first two of an Audient EVO4's four input channels, even when four were
  requested. The other two, probably its loopback pair, cannot be captured from the browser. The capture path
  averages the channels it receives.
- The app runs in a browser. It has been tested in Chromium on Apple silicon only. Safari and Firefox are not
  tested.
- `/api/look` has no authentication or rate limiting. Run it on localhost or add both before deploying.

## Status

The software milestones are built and tested. Tuning with real hardware (the audio interface, a room
microphone, real tracks, input latency) is the remaining step and needs a session with the hardware.
