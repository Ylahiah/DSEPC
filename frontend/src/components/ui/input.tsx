import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-900 shadow-2xs transition-colors outline-none placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'

export { Input }
