import { useCallback, useEffect, useRef, useState } from "react"

// Web Speech API wrapper for chat composer dictate.
//
// Design notes (see workflow spec dictate-mic-feature-design):
//  - The caller (ChatComposer) owns textarea state. This hook NEVER touches
//    it; it only fires callbacks. Single source of truth, no double-write.
//  - Callbacks are stashed in a ref each render so the recognizer instance
//    is built once per session, not re-built on every keystroke.
//  - Each `start()` builds a fresh SpeechRecognition instance — Safari
//    does not reliably restart an aborted one.
//  - We do NOT auto-restart on `end`. The user re-taps consciously. Auto-
//    restart looks buggy and is a privacy footgun.
//  - `aborted` is treated as silent (user-initiated) — no error toast.
//  - `no-speech` is suppressed if any final result was committed this
//    session — natural mid-sentence pauses should not toast.
//
// Public API:
//   { isSupported, isListening, interim, start, stop, abort }
//
// Callbacks (all optional):
//   onResult({ interim, final, isFinal })
//   onError(code)   — "not-allowed" | "no-speech" | "audio-capture"
//                    | "network" | "language-not-supported"
//                    | "not-supported" | "unknown"
//   onStart()       — fires when the engine `start` event arrives
//   onEnd()         — fires when the engine `end` event arrives

function getEngine() {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

const KNOWN_ERROR_CODES = new Set([
  "not-allowed",
  "no-speech",
  "audio-capture",
  "network",
  "aborted",
  "language-not-supported",
])

export function useSpeechRecognition(options) {
  // Feature-detect once at mount; never re-evaluates.
  const [isSupported] = useState(() => !!getEngine())
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState("")

  const recognitionRef = useRef(null)
  const startingRef = useRef(false)
  const wantListeningRef = useRef(false)
  // Did this session already commit at least one final result? Drives the
  // `no-speech` debounce so mid-sentence pauses don't surface as errors.
  const committedRef = useRef(false)

  // Callback refs — re-read on every event so the recognizer doesn't need
  // to be rebuilt when the caller's closure changes. Synced via useEffect
  // to keep the react-hooks/refs-in-render lint rule happy.
  const callbacksRef = useRef(options)
  useEffect(() => {
    callbacksRef.current = options
  })

  const buildRecognition = useCallback(() => {
    const Engine = getEngine()
    if (!Engine) return null
    const r = new Engine()
    const o = callbacksRef.current || {}
    r.lang = o.lang || "tr-TR"
    r.continuous = o.continuous ?? true
    r.interimResults = o.interimResults ?? true
    r.maxAlternatives = 1

    r.onstart = () => {
      startingRef.current = false
      setIsListening(true)
      callbacksRef.current?.onStart?.()
    }

    r.onresult = (event) => {
      let interimText = ""
      let newFinal = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ""
        if (result.isFinal) {
          newFinal += text
        } else {
          interimText += text
        }
      }
      const trimmedFinal = newFinal.trim()
      if (trimmedFinal) {
        committedRef.current = true
        callbacksRef.current?.onResult?.({
          interim: "",
          final: trimmedFinal,
          isFinal: true,
        })
      }
      setInterim(interimText)
      if (interimText) {
        callbacksRef.current?.onResult?.({
          interim: interimText,
          final: "",
          isFinal: false,
        })
      }
    }

    r.onerror = (event) => {
      const raw = event?.error || "unknown"
      const code = KNOWN_ERROR_CODES.has(raw) ? raw : "unknown"
      startingRef.current = false
      wantListeningRef.current = false
      setIsListening(false)
      setInterim("")
      // user-initiated stop — never noisy
      if (code === "aborted") return
      // natural pause inside a session that already produced text — soft-swallow
      if (code === "no-speech" && committedRef.current) return
      callbacksRef.current?.onError?.(code)
    }

    r.onend = () => {
      startingRef.current = false
      wantListeningRef.current = false
      setIsListening(false)
      setInterim("")
      callbacksRef.current?.onEnd?.()
    }

    return r
  }, [])

  const start = useCallback(() => {
    if (!isSupported) {
      callbacksRef.current?.onError?.("not-supported")
      return
    }
    if (isListening || startingRef.current) return

    const r = buildRecognition()
    if (!r) return

    recognitionRef.current = r
    committedRef.current = false
    startingRef.current = true
    wantListeningRef.current = true

    // Apply latest lang in case the caller switched locales between starts.
    const o = callbacksRef.current || {}
    if (o.lang) r.lang = o.lang

    try {
      r.start()
    } catch (e) {
      startingRef.current = false
      wantListeningRef.current = false
      // Safari throws InvalidStateError on rapid double-start — swallow.
      if (e?.name !== "InvalidStateError") {
        callbacksRef.current?.onError?.("unknown")
      }
    }
  }, [isSupported, isListening, buildRecognition])

  const stop = useCallback(() => {
    const r = recognitionRef.current
    if (!r) return
    wantListeningRef.current = false
    try {
      // graceful — lets the last utterance finalize
      r.stop()
    } catch {
      // ignore
    }
  }, [])

  const abort = useCallback(() => {
    const r = recognitionRef.current
    if (!r) return
    wantListeningRef.current = false
    try {
      // hard cancel — drops in-flight interim
      r.abort()
    } catch {
      // ignore
    }
  }, [])

  // Unmount cleanup. Critical: Chrome can fire `onend` ~200 ms after
  // abort, which would setState on an unmounted component. Null the
  // handlers BEFORE abort to block that.
  useEffect(() => {
    return () => {
      const r = recognitionRef.current
      if (!r) return
      try {
        r.onstart = null
        r.onresult = null
        r.onerror = null
        r.onend = null
        r.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
      wantListeningRef.current = false
      startingRef.current = false
    }
  }, [])

  return { isSupported, isListening, interim, start, stop, abort }
}
