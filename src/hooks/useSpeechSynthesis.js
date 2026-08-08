import { useCallback, useEffect, useRef, useState } from "react"

// Thin wrapper around window.speechSynthesis for the orb's click-to-speak.
//
// Why a hook: the synth API is global (singleton), but the caller wants
// React-friendly state (isSpeaking flips a className) and stable callbacks.
// Voices load asynchronously on first page load — Chrome fires
// `voiceschanged` once they arrive — so the hook re-renders when they
// land and the next speak() call gets the best match for the requested lang.
//
// Public API:
//   { isSupported, isSpeaking, speak(text, opts?), cancel() }
//
// opts (all optional):
//   - lang: BCP-47 tag ("tr-TR", "en-US"). Default: browser default.
//   - rate: 0.1–10, default 1.
//   - pitch: 0–2, default 1.
//   - volume: 0–1, default 1.
//   - onEnd: () => void  — fires on natural end or cancel.
//
// Caller contract: each speak() cancels any in-flight utterance first
// (single-channel — we never want overlapping voices).

function getSynth() {
  if (typeof window === "undefined") return null
  return window.speechSynthesis || null
}

export function useSpeechSynthesis() {
  const [isSupported] = useState(() => !!getSynth())
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState(() => getSynth()?.getVoices() ?? [])
  const utteranceRef = useRef(null)

  // Voices load async on first page paint. Chrome fires `voiceschanged`
  // exactly once when the list arrives; Safari has them ready synchronously.
  useEffect(() => {
    const synth = getSynth()
    if (!synth) return
    const onChange = () => setVoices(synth.getVoices())
    synth.addEventListener("voiceschanged", onChange)
    // Some browsers don't fire voiceschanged if voices were already there.
    const initial = synth.getVoices()
    if (initial.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVoices(initial)
    }
    return () => synth.removeEventListener("voiceschanged", onChange)
  }, [])

  // Pick the smoothest, most natural-sounding voice for a given lang.
  //
  // Web Speech API doesn't expose gender or quality directly, so we score
  // each voice by name patterns + localService flag:
  //   - exact lang match: +100  | prefix match: +50  | no match: skip
  //   - female-leaning name (TR: Filiz, Yelda, Ayşe, Emel; EN: Zira, Aria,
  //     Samantha, Jenny; generic: Neural, Natural, Female): +30
  //   - cloud / non-local voice (localService === false, e.g. Google Cloud
  //     or Edge Neural voices — usually much smoother than OS-bundled): +15
  //   - any voice with "google" in the name: +5 (Chrome's TTS is reliably
  //     smoother than the Windows default TR voice Tolga)
  // Highest-scoring voice wins; ties go to the first one seen.
  const pickVoice = useCallback(
    (lang) => {
      if (!lang || voices.length === 0) return null
      const prefix = lang.split("-")[0]
      let best = null
      let bestScore = -1
      for (const v of voices) {
        const vLang = v.lang || ""
        let score
        if (vLang === lang) score = 100
        else if (vLang.startsWith(prefix)) score = 50
        else continue
        const name = (v.name || "").toLowerCase()
        if (
          /(filiz|yelda|ayşe|ayse|emel|aslı|asli|zeynep|tülay|tulay|zira|aria|samantha|jenny|susan|kate|emma|natural|neural|female|kadın|woman)/i.test(
            name,
          )
        ) {
          score += 30
        }
        if (v.localService === false) score += 15
        if (name.includes("google")) score += 5
        if (score > bestScore) {
          bestScore = score
          best = v
        }
      }
      return best
    },
    [voices],
  )

  const speak = useCallback(
    (text, opts = {}) => {
      const synth = getSynth()
      if (!synth || !text) return
      // Cancel any in-flight utterance — single-channel.
      try {
        synth.cancel()
      } catch {
        // ignore
      }
      const u = new SpeechSynthesisUtterance(text)
      if (opts.lang) u.lang = opts.lang
      if (typeof opts.rate === "number") u.rate = opts.rate
      if (typeof opts.pitch === "number") u.pitch = opts.pitch
      if (typeof opts.volume === "number") u.volume = opts.volume
      const voice = pickVoice(opts.lang)
      if (voice) u.voice = voice

      u.onstart = () => setIsSpeaking(true)
      u.onend = () => {
        setIsSpeaking(false)
        opts.onEnd?.()
      }
      u.onerror = () => {
        setIsSpeaking(false)
      }

      utteranceRef.current = u
      try {
        synth.speak(u)
      } catch {
        setIsSpeaking(false)
      }
    },
    [pickVoice],
  )

  const cancel = useCallback(() => {
    const synth = getSynth()
    if (!synth) return
    try {
      synth.cancel()
    } catch {
      // ignore
    }
    setIsSpeaking(false)
  }, [])

  // Unmount cleanup — never leave a stray voice playing after the component
  // unmounts (e.g. user navigates away mid-speech).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      const synth = getSynth()
      if (!synth) return
      try {
        synth.cancel()
      } catch {
        // ignore
      }
    }
  }, [])

  return { isSupported, isSpeaking, speak, cancel }
}
