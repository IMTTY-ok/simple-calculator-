import { Monitor, Moon, Sun } from 'lucide-react'

import { useSettings, type ThemePreference } from '../../hooks/settingsContext'
import { cn } from '../../utils/cn'
import { Toggle } from './Toggle'

interface SettingsPanelProps {
  historyCount: number
  onClearHistory: () => void
}

const THEME_OPTIONS: Array<{
  value: ThemePreference
  label: string
  icon: typeof Moon
}> = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

/**
 * Preferences: theme, feedback and data.
 */
export function SettingsPanel({ historyCount, onClearHistory }: SettingsPanelProps) {
  const { settings, setSetting, hapticsSupported, prefersReducedMotion } = useSettings()

  return (
    <div className="flex flex-col gap-6 pb-2">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
          Appearance
        </h3>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex gap-1 rounded-[14px] bg-surface-3 p-1"
        >
          {THEME_OPTIONS.map((option) => {
            const active = settings.theme === option.value
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSetting('theme', option.value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-2',
                  'text-[12.5px] font-medium transition-[background-color,color,box-shadow] duration-[160ms] ease-soft',
                  active
                    ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.18)]'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                {option.label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
          Feedback
        </h3>
        <div className="divide-y divide-hairline">
          <Toggle
            label="Haptic feedback"
            description={
              hapticsSupported
                ? 'Short pulses confirm number, operator and equals presses.'
                : 'This browser does not expose the Vibration API — sound is used instead.'
            }
            checked={settings.haptics}
            onChange={(value) => setSetting('haptics', value)}
          />
          <Toggle
            label="Sound feedback"
            description="A soft click on every key. Off by default."
            checked={settings.sound}
            onChange={(value) => setSetting('sound', value)}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
          Motion
        </h3>
        <div className="divide-y divide-hairline">
          <Toggle
            label="Reduce motion"
            description={
              prefersReducedMotion
                ? 'Already reduced by your system settings.'
                : 'Removes movement and keeps only colour changes.'
            }
            checked={settings.reducedMotion}
            onChange={(value) => setSetting('reducedMotion', value)}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
          Data
        </h3>
        <div className="divide-y divide-hairline">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-[13.5px] font-medium leading-5 text-ink">Clear history</p>
              <p className="mt-0.5 text-[12px] leading-[1.45] text-ink-dim">
                {historyCount === 0
                  ? 'No stored calculations.'
                  : `${historyCount} calculation${historyCount === 1 ? '' : 's'} stored on this device.`}
              </p>
            </div>
            <button
              type="button"
              disabled={historyCount === 0}
              onClick={onClearHistory}
              className={cn(
                'shrink-0 rounded-[10px] border border-hairline px-3 py-1.5',
                'text-[12.5px] font-medium text-ink-muted',
                'transition-[background-color,color,border-color] duration-[140ms] ease-soft',
                'hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <p className="pb-1 text-[11.5px] leading-relaxed text-ink-dim">
        Preferences and history stay on this device. Calculator works offline and sends nothing
        anywhere.
      </p>
    </div>
  )
}
