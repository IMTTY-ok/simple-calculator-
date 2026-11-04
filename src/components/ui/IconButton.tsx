import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../../utils/cn'

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** Accessible name — required, the icon itself is decorative. */
  label: string
  children: ReactNode
  /** Visual size of the button. */
  size?: 'sm' | 'md'
  /** Toggled-on styling, e.g. when a panel is open. */
  active?: boolean
}

/**
 * A square, borderless icon button used in the top bar.
 */
export function IconButton({
  label,
  children,
  size = 'md',
  active = false,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'text-ink-muted transition-[color,background-color,transform] duration-[120ms] ease-soft',
        'hover:text-ink active:scale-95',
        size === 'sm' ? 'size-8' : 'size-10',
        active && 'bg-surface-3 text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
