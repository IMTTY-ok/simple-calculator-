import { useEffect, useRef } from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '../../utils/cn'

export type CopyStatus = 'idle' | 'copied' | 'failed'

interface DisplayProps {
  /** The expression as text, e.g. `200 + 10%`. */
  expression: string
  /** The large value, e.g. `220`. */
  value: string
  /** Live result preview, e.g. `= 220`. */
  preview: string | null
  /** True when the expression cannot be evaluated. */
  hasError: boolean
  onCopy: () => void
  copyStatus: CopyStatus
  /** Increments whenever the display is cleared, to replay the reset motion. */
  resetSignal: number
}

/**
 * The display: a small expression line, a large value and a live preview.
 *
 * The value's size is derived from its own length using container query
 * units, so long numbers shrink to fit instead of overflowing or forcing the
 * layout to reflow.
 */
export function Display({
  expression,
  value,
  preview,
  hasError,
  onCopy,
  copyStatus,
  resetSignal,
}: DisplayProps) {
  const expressionRef = useRef<HTMLDivElement>(null)

  // Keep the tail of a long expression visible.
  useEffect(() => {
    const element = expressionRef.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [expression])

  return (
    <section
      className="calculator-display"
      aria-label="Calculator display"
      style={{ '--value-chars': Math.max(value.length, 1) } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          ref={expressionRef}
          className="expression-scroll tnum min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-right font-mono text-[13px] leading-5 tracking-tight text-ink-muted"
          aria-hidden={expression.length === 0}
        >
          {expression}
        </div>

        <button
          type="button"
          onClick={onCopy}
          disabled={hasError}
          aria-label="Copy result to clipboard"
          className={cn(
            'copy-button -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full',
            'text-ink-dim transition-[color,background-color,opacity] duration-[140ms] ease-soft',
            'hover:bg-surface-3 hover:text-ink',
            'disabled:pointer-events-none disabled:opacity-30',
          )}
        >
          {copyStatus === 'copied' ? (
            <Check key="copied" size={15} strokeWidth={2.4} className="copy-confirm" aria-hidden="true" />
          ) : (
            <Copy key="idle" size={15} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>

      <output
        className="display-value tnum mt-1 block text-right font-semibold leading-[1.05] tracking-[-0.035em]"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Re-keying on reset replays the reset motion without animating
            every digit the user types. */}
        <span key={resetSignal} className="display-value__glyph">
          <span className={hasError ? 'text-danger' : undefined}>{value}</span>
        </span>
      </output>

      <div className="mt-1 h-5 text-right font-mono text-[12.5px] leading-5 text-ink-dim">
        {preview ? <span aria-hidden="true">{preview}</span> : null}
      </div>
    </section>
  )
}
