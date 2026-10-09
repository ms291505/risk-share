import { useState } from 'react'

/**
 * The value, or while it's null, the last value that wasn't. A dialog whose
 * `open` depends on a value keeps showing its content while it fades out.
 */
export function useLastNonNull<T>(value: T | null): T | null {
  const [last, setLast] = useState(value)
  if (value !== null && value !== last) setLast(value)
  return value ?? last
}
