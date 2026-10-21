# Afterimage

A listen-only, audio-reactive visual deck for DJs playing EDM, tech house, dubstep and trance.
It listens to an input device, drives fullscreen GPU visuals from the music, recognizes tracks you
enrolled, and switches to each track's saved look.

Work in progress. This README is a stub that is extended as the milestones land.

## Quick start

This project uses [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local
pnpm dev -p 4617 -H 127.0.0.1
```

Open http://127.0.0.1:4617.

`-H 127.0.0.1` keeps the dev server off your network. `/api/look` spends your OpenRouter key for any
caller that can reach it.

## Secrets

The OpenRouter key goes in `.env.local` (gitignored) or in the in-app Settings field (stored in
`localStorage`). Never commit a key. `.env.example` lists the variables.

| Variable | Purpose | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Key used by `/api/look` | none (local heuristic is used) |
| `OPENROUTER_MODEL` | Model used by `/api/look` | `openai/gpt-4o-mini` |
