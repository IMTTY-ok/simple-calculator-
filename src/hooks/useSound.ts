/**
 * Optional sound feedback.
 *
 * A calculator with haptics alone is silent on iOS, where the Vibration API
 * does not exist. These short synthesised clicks give the device an audible
 * texture instead — they are synthesised with the Web Audio API (no assets,
 * no network, works offline).
 *
 * The `AudioContext` is created lazily on the first user gesture, because
 * browsers refuse to start audio before the user has interacted with the
 * page.
 */

import { useCallback, useEffect, useRef } from 'react'

/** The distinct sounds used across the app. */
export type SoundPattern = 'digit' | 'operator' | 'equals' | 'clear' | 'error'

interface ToneSpec {
  frequency: number
  duration: number
  gain: number
  /** Optional second partial, used for the confirmation chime. */
  overtone?: number
}

const TONES: Record<SoundPattern, ToneSpec> = {
  digit: { frequency: 1180, duration: 0.032, gain: 0.035 },
  operator: { frequency: 860, duration: 0.045, gain: 0.04 },
  equals: { frequency: 980, duration: 0.055, gain: 0.045, overtone: 1470 },
  clear: { frequency: 640, duration: 0.05, gain: 0.04 },
  error: { frequency: 240, duration: 0.11, gain: 0.05 },
}

type AudioContextCtor = new () => AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

/**
 * Returns a function that plays the given sound pattern.
 *
 * The sound is intentionally quiet and short: it should feel like the click of
 * a key, not like a notification.
 */
export function useSound(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)

  useEffect(() => {
    return () => {
      void contextRef.current?.close().catch(() => undefined)
      contextRef.current = null
    }
  }, [])

  const ensureContext = useCallback((): AudioContext | null => {
    if (contextRef.current) {
      if (contextRef.current.state === 'suspended') {
        void contextRef.current.resume().catch(() => undefined)
      }
      return contextRef.current
    }
    const Ctor = getAudioContextCtor()
    if (!Ctor) return null
    try {
      const context = new Ctor()
      contextRef.current = context
      return context
    } catch {
      return null
    }
  }, [])

  const play = useCallback(
    (pattern: SoundPattern) => {
      if (!enabled) return
      const context = ensureContext()
      if (!context) return

      const spec = TONES[pattern]
      const now = context.currentTime

      // Body tone — a short pitched blip with a fast decay.
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(spec.frequency, now)
      oscillator.frequency.exponentialRampToValueAtTime(
        spec.frequency * 0.62,
        now + spec.duration,
      )

      const envelope = context.createGain()
      envelope.gain.setValueAtTime(0.0001, now)
      envelope.gain.exponentialRampToValueAtTime(spec.gain, now + 0.004)
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration)

      oscillator.connect(envelope)
      envelope.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + spec.duration + 0.02)

      // Transient — a 4 ms band-passed noise burst that sells the "click".
      if (!noiseRef.current) {
        const frames = Math.floor(context.sampleRate * 0.05)
        const buffer = context.createBuffer(1, frames, context.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < frames; i += 1) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
        }
        noiseRef.current = buffer
      }

      const noise = context.createBufferSource()
      noise.buffer = noiseRef.current
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2400
      filter.Q.value = 0.8
      const noiseGain = context.createGain()
      noiseGain.gain.setValueAtTime(spec.gain * 0.55, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(context.destination)
      noise.start(now)
      noise.stop(now + 0.05)

      // Optional overtone for the confirmation chime.
      if (spec.overtone) {
        const chime = context.createOscillator()
        chime.type = 'sine'
        chime.frequency.setValueAtTime(spec.overtone, now)
        const chimeGain = context.createGain()
        chimeGain.gain.setValueAtTime(0.0001, now)
        chimeGain.gain.exponentialRampToValueAtTime(spec.gain * 0.6, now + 0.006)
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration * 1.6)
        chime.connect(chimeGain)
        chimeGain.connect(context.destination)
        chime.start(now)
        chime.stop(now + spec.duration * 1.6 + 0.02)
      }
    },
    [enabled, ensureContext],
  )

  return play
}
