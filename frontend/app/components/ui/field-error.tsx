import type { FieldError as RHFFieldError } from 'react-hook-form'

/** Inline validation message for a React Hook Form field. */
export function FieldError({ error }: { error?: RHFFieldError }) {
  if (!error?.message) return null
  return (
    <p role="alert" className="mt-1 text-sm font-medium text-red-700">
      {error.message}
    </p>
  )
}
