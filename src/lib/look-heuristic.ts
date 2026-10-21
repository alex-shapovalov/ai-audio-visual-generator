import type { LookRequest, LookResponse } from "@/lib/look-schema"
import { PALETTES } from "@/lib/palettes"
import type { Look, SceneId } from "@/lib/types"

type Rule = { pattern: RegExp; scene: SceneId; palette: string; strobe: boolean; warp: number }

const GENRE_RULES: Rule[] = [
  { pattern: /dubstep|riddim|brostep|bass|heavy|wobble|drop/, scene: "rift", palette: "dubstep", strobe: true, warp: 0.8 },
  { pattern: /techno|industrial|hard|strobe|warehouse/, scene: "strobe", palette: "mono", strobe: true, warp: 0.4 },
  { pattern: /tech ?house|house|minimal|groove|club|disco/, scene: "grid", palette: "house", strobe: false, warp: 0.3 },
  { pattern: /trance|melodic|progressive|uplifting|dreamy|portal|tunnel/, scene: "portal", palette: "trance", strobe: false, warp: 0.4 },
  { pattern: /equali[sz]er|spectrum|\bbars?\b|vu meter/, scene: "bars", palette: "synthwave", strobe: false, warp: 0.3 },
  { pattern: /aurora|northern lights|ambient|chill|calm|ocean|liquid|downtempo|lo-?fi/, scene: "aurora", palette: "abyss", strobe: false, warp: 0.4 },
  { pattern: /warp|hyperspace|starfield|\bstars?\b|galaxy|cosmic|space|rocket/, scene: "warp", palette: "ice", strobe: false, warp: 0.5 },
  { pattern: /laser|rave|beam|festival|main ?stage|big room|\bedm\b/, scene: "lasers", palette: "synthwave", strobe: false, warp: 0.5 },
  { pattern: /bloom|flower|mandala|lotus|petal|psychedelic|\bpsy\b/, scene: "bloom", palette: "royal", strobe: false, warp: 0.4 },
]

const COLOR_RULES: { pattern: RegExp; palette: string }[] = [
  { pattern: /red|fire|ember|orange|hot/, palette: "ember" },
  { pattern: /green|acid|magenta|pink|neon/, palette: "dubstep" },
  { pattern: /cyan|blue|violet|purple|ice/, palette: "trance" },
  { pattern: /amber|gold|warm|bone|cream/, palette: "house" },
  { pattern: /mono|black and white|b&w|grayscale/, palette: "mono" },
  { pattern: /sunset|sunrise|peach|coral|flamingo/, palette: "sunset" },
  { pattern: /frost|snow|arctic|glacier/, palette: "ice" },
  { pattern: /toxic|radioactive|lime|slime|venom/, palette: "toxic" },
  { pattern: /royal|regal|majestic|emperor|jewel/, palette: "royal" },
  { pattern: /crimson|blood|maroon|wine|scarlet/, palette: "crimson" },
  { pattern: /synthwave|retrowave|outrun|vaporwave|cyberpunk|\b80s\b/, palette: "synthwave" },
  { pattern: /ocean|sea|abyss|underwater|teal/, palette: "abyss" },
]

const MEDIA_WORDS = /\b(media|video|image|logo|photo|clip|my)\b/

export const heuristicLook = (request: LookRequest): LookResponse => {
  const text = `${request.title ?? ""} ${request.prompt ?? ""}`.toLowerCase()
  const genre = GENRE_RULES.find((rule) => rule.pattern.test(text))
  const stats = request.stats

  let scene: SceneId = genre?.scene ?? "portal"
  let paletteId = genre?.palette ?? "trance"
  let strobe = genre?.strobe ?? false
  let warp = genre?.warp ?? 0.4

  if (!genre && stats) {
    if (stats.bass > 0.75) {
      scene = "rift"
      paletteId = "dubstep"
      strobe = true
      warp = 0.7
    } else if (stats.brightness > 0.06) {
      scene = "grid"
      paletteId = "house"
    }
  }

  const colorRule = COLOR_RULES.find((rule) => rule.pattern.test(text))
  if (colorRule) paletteId = colorRule.palette

  const wantsMedia = MEDIA_WORDS.test(text) && request.media.length > 0
  const mediaId = wantsMedia ? request.media[0].id : null
  if (wantsMedia) scene = "media"

  const palette = PALETTES.find((entry) => entry.id === paletteId) ?? PALETTES[2]
  const look: Look = {
    scene,
    colors: palette.colors,
    mediaId,
    mediaMix: wantsMedia ? 0.9 : 0.5,
    strobe,
    warp,
    kaleido: /kaleido|mirror|fractal/.test(text),
  }
  return {
    look,
    reason: "Picked locally from keywords and track stats (no AI model used).",
    source: "heuristic",
  }
}
