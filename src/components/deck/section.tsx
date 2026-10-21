import type { ReactNode } from "react"

type SectionProps = { title: string; hint?: string; children: ReactNode }

export function Section({ title, hint, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-2.5 py-3" aria-label={title}>
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </h3>
        {hint ? <span className="text-right text-xs text-muted-foreground">{hint}</span> : null}
      </header>
      {children}
    </section>
  )
}
