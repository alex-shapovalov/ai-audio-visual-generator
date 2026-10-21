import { SCENES, type SceneId } from "@/lib/types"

const SCENE_KEYS = ["1", "2", "3", "4", "5"]
const TYPING_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [role='combobox'], [role='listbox'], [role='textbox']"

export const sceneForKey = (key: string): SceneId | null => {
  const index = SCENE_KEYS.indexOf(key)
  return index === -1 ? null : SCENES[index]
}

export const isTypingTarget = (target: EventTarget | null) =>
  (target as Element | null)?.closest?.(TYPING_SELECTOR) != null
