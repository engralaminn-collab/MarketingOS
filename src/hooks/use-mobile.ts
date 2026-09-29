import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Subscribes to viewport width changes through the same media query the hook
 * has always used. Returning the unsubscribe function keeps the listener
 * cleaned up when the last consumer unmounts.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

/** Client snapshot — identical breakpoint check to the previous implementation. */
function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

/**
 * Server snapshot — `window` does not exist during SSR. `false` matches the
 * value the previous implementation rendered on the server and on the first
 * client render (`!!undefined`), so hydration output is unchanged.
 */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Reads the mobile breakpoint from an external store instead of mirroring it
 * into React state from an effect. `useSyncExternalStore` reads the real value
 * during render, so there is no synchronous setState and no cascading render.
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
