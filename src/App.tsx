import { useCallback, useState } from 'react'

import { Calculator } from './components/Calculator/Calculator'
import { HistoryPanel } from './components/History/HistoryPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { Sheet } from './components/ui/Sheet'
import { TopBar } from './components/TopBar'
import { getActiveOperator } from './engine/calculatorEngine'
import type { KeyDefinition } from './engine/keyDefinitions'
import { useCalculator } from './hooks/useCalculator'
import { useHistory } from './hooks/useHistory'
import { useKeyboard } from './hooks/useKeyboard'
import { useSettings } from './hooks/settingsContext'
import type { HistoryEntry } from './types/calculator'

type Panel = 'history' | 'settings' | null

/**
 * The application shell.
 */
export function App() {
  const { settings } = useSettings()
  const history = useHistory()

  const { state, display, dispatch } = useCalculator({
    hapticsEnabled: settings.haptics,
    soundEnabled: settings.sound,
    onResult: history.add,
  })

  // The engine counts resets so the display can replay a short reset motion
  // without animating every typed digit.
  const resetSignal = state.resetCount

  const [panel, setPanel] = useState<Panel>(null)
  const togglePanel = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next))
  }

  // Physical keyboard support. Suspended while a panel is open so that
  // Escape closes the panel instead of clearing the calculator.
  useKeyboard(dispatch, panel === null)

  const handlePress = useCallback(
    (definition: KeyDefinition) => {
      dispatch(definition.action)
    },
    [dispatch],
  )

  const handleReuse = useCallback(
    (entry: HistoryEntry) => {
      dispatch({ type: 'set-entry', value: String(entry.value) })
      setPanel(null)
    },
    [dispatch],
  )

  const activeOperator = getActiveOperator(state)

  return (
    <div className="app-shell">
      <TopBar
        onOpenHistory={() => togglePanel('history')}
        onOpenSettings={() => togglePanel('settings')}
        historyActive={panel === 'history'}
      />

      <main className="app-main">
        <div className="app-stage">
          <Calculator
            display={display}
            activeOperator={activeOperator}
            onPress={handlePress}
            resetSignal={resetSignal}
          />

          <p className="keyboard-hint">
            <kbd>0–9</kbd>
            <span aria-hidden="true">·</span>
            <kbd>+ − × ÷</kbd>
            <span aria-hidden="true">·</span>
            <kbd>Enter</kbd>
            <span aria-hidden="true">=</span>
            <span aria-hidden="true">·</span>
            <kbd>Esc</kbd>
            <span aria-hidden="true">clear</span>
          </p>
        </div>
      </main>

      <Sheet
        open={panel === 'history'}
        onClose={() => setPanel(null)}
        title="History"
        description="Calculations are stored on this device only."
        footer={
          history.entries.length > 0 ? (
            <button
              type="button"
              onClick={history.clear}
              className="w-full rounded-[12px] border border-hairline py-2 text-[12.5px] font-medium text-ink-muted transition-[background-color,color] duration-[140ms] ease-soft hover:bg-danger-soft hover:text-danger"
            >
              Clear all history
            </button>
          ) : null
        }
      >
        <HistoryPanel
          entries={history.entries}
          onSelect={handleReuse}
          onRemove={history.remove}
        />
      </Sheet>

      <Sheet
        open={panel === 'settings'}
        onClose={() => setPanel(null)}
        title="Settings"
        description="Feedback, appearance and stored data."
      >
        <SettingsPanel historyCount={history.entries.length} onClearHistory={history.clear} />
      </Sheet>
    </div>
  )
}
