"use client"

import { useRef, useState } from "react"
import { decodeForMatching } from "@/audio/decode"
import type { MatcherClient } from "@/audio/matcher-client"
import type { Library } from "@/components/deck/use-library"
import { newId } from "@/lib/db"
import { errorMessage } from "@/lib/error-message"
import { titleFromFileName } from "@/lib/format"
import type { LookRequest, LookResponse } from "@/lib/look-schema"
import { DEFAULT_LOOK } from "@/lib/palettes"
import type { CueRecord } from "@/lib/types"

export const MIN_HASHES = 200
export const NOT_DISTINCTIVE = "Not enough distinctive audio to recognize this track"

export type EnrollStage = "queued" | "decoding" | "fingerprinting" | "choosing a look" | "done" | "failed"

export type EnrollJob = {
  id: number
  name: string
  stage: EnrollStage
  message: string | null
}

export type Fingerprinter = Pick<MatcherClient, "enroll">

type Options = {
  fingerprinter: Fingerprinter | null
  library: Pick<Library, "media" | "addCue" | "updateCue">
  suggest: (request: LookRequest) => Promise<LookResponse>
}

const summarize = (response: LookResponse) => {
  if (response.source === "openrouter") return "Look chosen by the AI director"
  const reason = response.note ? ` (${response.note})` : ""
  return `Look chosen locally${reason}`
}

export type Enrollment = ReturnType<typeof useEnrollment>

export const useEnrollment = ({ fingerprinter, library, suggest }: Options) => {
  const [jobs, setJobs] = useState<EnrollJob[]>([])
  const nextId = useRef(1)

  const update = (id: number, patch: Partial<EnrollJob>) =>
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)))

  const enrollOne = async (file: File, id: number) => {
    if (!fingerprinter) return
    try {
      update(id, { stage: "decoding" })
      const samples = await decodeForMatching(file)
      update(id, { stage: "fingerprinting" })
      const print = await fingerprinter.enroll(samples)
      if (print.hashes.length < MIN_HASHES) {
        update(id, { stage: "failed", message: NOT_DISTINCTIVE })
        return
      }

      const cue: CueRecord = {
        id: newId(),
        title: titleFromFileName(file.name),
        createdAt: Date.now(),
        stats: print.stats,
        hashes: print.hashes,
        times: print.times,
        look: DEFAULT_LOOK,
      }
      await library.addCue(cue)
      update(id, { stage: "choosing a look" })
      const response = await suggest({
        title: cue.title,
        stats: cue.stats,
        media: library.media.map((item) => ({ id: item.id, name: item.name })),
      })
      await library.updateCue(cue.id, (current) => ({ ...current, look: response.look }))
      update(id, { stage: "done", message: summarize(response) })
    } catch (cause) {
      update(id, { stage: "failed", message: errorMessage(cause, "This file could not be enrolled") })
    }
  }

  const enroll = async (files: File[]) => {
    const queued = files.map((file) => ({ file, id: nextId.current++ }))
    const entries = queued.map(({ file, id }): EnrollJob => ({ id, name: file.name, stage: "queued", message: null }))
    setJobs((current) => [...entries, ...current])
    for (const { file, id } of queued) await enrollOne(file, id)
  }

  return {
    jobs,
    busy: jobs.some((job) => job.stage !== "done" && job.stage !== "failed"),
    enroll,
    clearFinished: () =>
      setJobs((current) => current.filter((job) => job.stage !== "done" && job.stage !== "failed")),
  }
}
