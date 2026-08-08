import { useEffect, useState } from "react"

// Subscribe to window.visualViewport so the chat composer (and any other
// keyboard-pinned element) can know the on-screen keyboard's height. iOS
// Safari does NOT shrink window.innerHeight when the keyboard opens — only
// visualViewport.height changes. Without this hook the composer ends up
// behind the keyboard.
//
// Returns `{ height, keyboardOffset }`:
// - height: visualViewport.height (excludes keyboard)
// - keyboardOffset: window.innerHeight - vv.height - vv.offsetTop
//   (positive when the keyboard is up, 0 otherwise)
//
// Older WebViews lack visualViewport — we degrade silently to keyboardOffset=0
// and height=innerHeight, so consumers can still render.
export function useVisualViewport() {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return { height: 0, keyboardOffset: 0 }
    const vv = window.visualViewport
    if (!vv) return { height: window.innerHeight, keyboardOffset: 0 }
    return {
      height: vv.height,
      keyboardOffset: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      setState({
        height: vv.height,
        keyboardOffset: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
      })
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return state
}
