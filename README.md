# Afterimage

A listen-only, audio-reactive visual deck for DJs playing EDM, tech house, dubstep and trance. It listens to an audio input, drives fullscreen GPU visuals from the music, and recognizes tracks you have enrolled so each one can have its own look.

Status: bootstrapping. See the milestone commits for progress.

## Requirements

- Node.js 22+
- Rust (stable) with the `wasm32-unknown-unknown` target and `wasm-pack`, only needed to rebuild the WebAssembly module

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENROUTER_API_KEY` in `.env.local` to enable the AI director. `.env.local` is gitignored; never commit a key.
