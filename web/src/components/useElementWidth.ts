import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The width of the element `ref` is attached to, kept up to date as it
 * resizes. Measured before paint, so a layout chosen from it doesn't flash.
 * Null where it can't be measured (no ResizeObserver, e.g. jsdom).
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}
