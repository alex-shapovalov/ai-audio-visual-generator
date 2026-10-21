import path from "node:path"

const directory = path.join(process.cwd(), "demo-audio")

export const DEMO = {
  techHouse: path.join(directory, "demo-tech-house-126.wav"),
  dubstep: path.join(directory, "demo-dubstep-140.wav"),
  trance: path.join(directory, "demo-trance-136.wav"),
}

export const DEMO_FILES = Object.values(DEMO)
