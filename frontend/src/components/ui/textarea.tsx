import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[90px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs transition-colors outline-none placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'

export { Textarea }
