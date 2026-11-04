import { History, Moon, Settings2, Sun } from 'lucide-react'

import { IconButton } from './ui/IconButton'
import { useSettings } from '../hooks/settingsContext'

interface TopBarProps {
  onOpenHistory: () => void
  onOpenSettings: () => void
  historyActive: boolean
}

/**
 * The application header: wordmark on the left, utilities on the right.
 */
export function TopBar({ onOpenHistory, onOpenSettings, historyActive }: TopBarProps) {
  const { resolvedTheme, toggleTheme } = useSettings()

  return (
    <header className="app-topbar">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0" aria-hidden="true">
          {/* A four-key keypad glyph: three outlined keys and one accent key. */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect
              x="2"
              y="2"
              width="8"
              height="8"
              rx="2.2"
              stroke="currentColor"
              strokeWidth="1.9"
              opacity="0.5"
            />
            <rect
              x="14"
              y="2"
              width="8"
              height="8"
              rx="2.2"
              stroke="currentColor"
              strokeWidth="1.9"
              opacity="0.5"
            />
            <rect
              x="2"
              y="14"
              width="8"
              height="8"
              rx="2.2"
              stroke="currentColor"
              strokeWidth="1.9"
              opacity="0.5"
            />
            <rect x="14" y="14" width="8" height="8" rx="2.2" fill="var(--pc-accent)" />
          </svg>
        </span>
        <span className="truncate font-mono text-[11.5px] font-medium uppercase tracking-[0.2em] text-ink">
          Calculator
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton
          label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={17} strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <Moon size={17} strokeWidth={1.9} aria-hidden="true" />
          )}
        </IconButton>

        <IconButton
          label="Calculation history"
          onClick={onOpenHistory}
          active={historyActive}
        >
          <History size={17} strokeWidth={1.9} aria-hidden="true" />
        </IconButton>

        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings2 size={17} strokeWidth={1.9} aria-hidden="true" />
        </IconButton>
      </div>
    </header>
  )
}
