import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'

import { useMediaQuery } from '../../hooks/useMediaQuery'
import { IconButton } from './IconButton'
import { cn } from '../../utils/cn'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Rendered in a sticky footer, e.g. a "clear all" action. */
  footer?: ReactNode
  /**
   * Whether the content region scrolls itself.
   *
   * Set to `hidden` when the content manages its own scrolling — an iframe,
   * for example — so the two scroll areas never fight each other.
   */
  contentOverflow?: 'auto' | 'hidden'
}

/**
 * A responsive overlay panel.
 *
 * On phones it is a bottom sheet; from tablet width upwards it becomes a
 * right-hand drawer. One component, two presentations, so the panels behave
 * identically everywhere.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  contentOverflow = 'auto',
}: SheetProps) {
  const reduceMotion = useReducedMotion()
  const isWide = useMediaQuery('(min-width: 768px)')
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Move focus into the sheet while it is open and restore it afterwards.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 40)
    return () => {
      window.clearTimeout(timer)
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  // Keep the latest `onClose` without re-registering the key listener on
  // every render — tearing the listener down mid-dispatch would make the
  // Escape key unreliable.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Escape closes the sheet.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Keep keyboard focus inside the dialog while it is open, so Tab can never
  // wander into the calculator behind the sheet.
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement)

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const panelMotion = isWide
    ? {
        initial: { x: reduceMotion ? 0 : '100%' },
        animate: { x: 0 },
        exit: { x: reduceMotion ? 0 : '100%' },
      }
    : {
        initial: { y: reduceMotion ? 0 : '100%' },
        animate: { y: 0 },
        exit: { y: reduceMotion ? 0 : '100%' },
      }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={[
              'absolute flex flex-col overflow-hidden border-hairline bg-surface',
              isWide
                ? 'inset-y-0 right-0 w-[min(380px,92vw)] border-l'
                : 'inset-x-0 bottom-0 max-h-[86dvh] rounded-t-[26px] border-t',
            ].join(' ')}
            style={
              isWide
                ? undefined
                : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }
            }
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={{
              duration: reduceMotion ? 0 : 0.26,
              ease: isWide ? [0.32, 0.72, 0, 1] : [0.32, 0.72, 0, 1],
            }}
          >
            {!isWide ? (
              <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-hairline-strong" />
              </div>
            ) : null}

            <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
                {description ? (
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-dim">{description}</p>
                ) : null}
              </div>
              <IconButton
                ref={closeButtonRef}
                label="Close"
                size="sm"
                onClick={onClose}
                className="-mr-1 -mt-0.5 shrink-0"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </IconButton>
            </header>

            <div
              className={cn(
                'min-h-0 flex-1 overscroll-contain px-5 pb-4',
                contentOverflow === 'hidden' ? 'overflow-hidden' : 'overflow-y-auto',
              )}
            >
              {children}
            </div>

            {footer ? (
              <footer className="border-t border-hairline px-5 py-3">{footer}</footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
