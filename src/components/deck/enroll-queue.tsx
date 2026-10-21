"use client"

import type { EnrollJob, EnrollStage } from "@/components/deck/use-enrollment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const VARIANTS: Record<EnrollStage, BadgeVariant> = {
  queued: "outline",
  decoding: "secondary",
  fingerprinting: "secondary",
  "choosing a look": "secondary",
  done: "default",
  failed: "destructive",
}

type EnrollQueueProps = { jobs: readonly EnrollJob[]; onClear: () => void }

export function EnrollQueue({ jobs, onClear }: EnrollQueueProps) {
  if (jobs.length === 0) return null
  const finished = jobs.some((job) => job.stage === "done" || job.stage === "failed")

  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Enrollment progress" aria-live="polite" className="flex flex-col gap-1.5">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" title={job.name}>
                {job.name}
              </span>
              <Badge variant={VARIANTS[job.stage]} className="capitalize">
                {job.stage}
              </Badge>
            </div>
            {job.message ? <span className="text-muted-foreground">{job.message}</span> : null}
          </li>
        ))}
      </ul>
      {finished ? (
        <Button type="button" size="xs" variant="ghost" className="self-end" onClick={onClear}>
          Clear finished
        </Button>
      ) : null}
    </div>
  )
}
