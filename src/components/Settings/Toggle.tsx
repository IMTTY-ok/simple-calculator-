import { cn } from '../../utils/cn'

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * A switch.
 *
 * Implemented as a `role="switch"` button so it is reachable by keyboard and
 * announced correctly, with the knob movement driven by a CSS transition so
 * it can be interrupted mid-flight.
 *
 * The button's hit area is 44 × 62 px even though the visible track is only
 * 44 × 26 px, so the control meets the 44 px minimum touch-target height.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium leading-5 text-ink">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-[1.45] text-ink-dim">{description}</p>
        ) : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-11 w-[62px] shrink-0',
          'transition-transform duration-[120ms] ease-soft',
          'active:scale-[0.97]',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <span
          className={cn(
            'absolute right-0 top-1/2 h-[26px] w-11 -translate-y-1/2 rounded-full',
            'transition-colors duration-[180ms] ease-soft',
            checked ? 'bg-accent' : 'bg-hairline-strong',
          )}
        >
          <span
            className={cn(
              // `left-0` anchors the knob to the track so the travel distance
              // is exact (44 − 20 − 2×3 = 18px) in both directions.
              'absolute left-0 top-[3px] size-5 rounded-full bg-white',
              'shadow-[0_1px_3px_rgb(0_0_0/0.28)]',
              'transition-transform duration-[180ms] ease-soft',
              checked ? 'translate-x-[21px]' : 'translate-x-[3px]',
            )}
          />
        </span>
      </button>
    </div>
  )
}
