import type { FieldValues, UseFormReturn, Path, PathValue } from 'react-hook-form'

/**
 * Lets pages that drive custom controlled widgets (zone picker, vendor picker,
 * dimension toggles) keep a `setFormData(prev => ({...prev, x}))` style API
 * while React Hook Form remains the single source of truth for state,
 * dirty tracking and Zod validation.
 */
export function createFormDataSetter<T extends FieldValues>(form: UseFormReturn<T>) {
  return (updater: Partial<T> | ((prev: T) => Partial<T>)) => {
    const current = form.getValues()
    const next = typeof updater === 'function' ? updater(current) : updater
    for (const key of Object.keys(next) as Array<Path<T>>) {
      const value = next[key as keyof T] as PathValue<T, Path<T>>
      if (current[key as keyof T] !== value) {
        form.setValue(key, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
      }
    }
  }
}

/** Toast-friendly first error message from a React Hook Form errors object. */
export function firstErrorMessage(errors: Record<string, unknown>): string {
  for (const value of Object.values(errors)) {
    const message = (value as { message?: unknown } | undefined)?.message
    if (typeof message === 'string' && message) return message
  }
  return 'Please fix the errors in the form'
}
