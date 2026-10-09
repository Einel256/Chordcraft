import * as Tone from 'tone'
import { midiToToneNote, voiceChordProgression } from './chordVoicing'

export type PlaybackCallbacks = { onChord: (index: number, soundingMidi: number[]) => void; onEnd: () => void }
export type SoundPreset = 'sine' | 'triangle' | 'piano' | 'bass'

/** Tone.js transport and synth lifecycle, kept separate from progression generation. */
export class ChordPlayback {
  private synth: Tone.PolySynth | null = null
  private reverb: Tone.Reverb | null = null
  private filter: Tone.Filter | null = null
  private soundPreset: SoundPreset = 'sine'
  private active = false
  private callbacks: PlaybackCallbacks | null = null
  private symbols: string[] = []
  private voicings: number[][] = []
  private loop = false
  private currentIndex = -1
  private nextIndex = 0
  private repeatEvent: number | null = null
  private octaveShift = 0
  private tickCount = 0
  private chordDuration: '4n' | '8n' = '4n'

  setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm
  }

  setSound(preset: SoundPreset) {
    if (this.soundPreset === preset) return
    this.soundPreset = preset
    this.synth?.dispose()
    this.filter?.dispose()
    this.synth = null
    this.filter = null
  }

  async start(symbols: string[], bpm: number, callbacks: PlaybackCallbacks, loop = false, rootOctave = 3, chordDuration: '4n' | '8n' = '4n') {
    await Tone.start()
    this.stop()
    await this.ensureSynth()
    this.callbacks = callbacks
    this.symbols = [...symbols]
    this.voicings = voiceChordProgression(this.symbols)
    this.loop = loop
    this.currentIndex = -1
    this.nextIndex = 0
    this.tickCount = 0
    this.chordDuration = chordDuration
    this.octaveShift = (rootOctave - 3) * 12
    this.active = true
    Tone.Transport.bpm.value = bpm
    // Tick on eighth-note boundaries; quarter-note chords play on every other tick.
    this.repeatEvent = Tone.Transport.scheduleRepeat(time => {
      if (!this.active) return
      const shouldPlay = this.chordDuration === '8n' || this.tickCount % 2 === 0
      this.tickCount += 1
      if (!shouldPlay) return
      if (this.nextIndex >= this.symbols.length) {
        if (!this.loop) {
          this.synth?.releaseAll(time)
          this.active = false
          this.currentIndex = -1
          this.callbacks?.onEnd()
          Tone.Transport.stop(time)
          if (this.repeatEvent !== null) Tone.Transport.clear(this.repeatEvent)
          this.repeatEvent = null
          return
        }
        this.nextIndex = 0
      }
      this.playIndex(this.nextIndex, time)
      this.nextIndex += 1
    }, '8n')
    Tone.Transport.start()
  }

  async preview(symbol: string, rootOctave = 3) {
    await Tone.start()
    await this.ensureSynth()
    const shift = (rootOctave - 3) * 12
    const notes = voiceChordProgression([symbol])[0].map(note => midiToToneNote(note + shift))
    this.synth?.triggerAttackRelease(notes, '2n', Tone.now(), 0.24)
  }

  /** Update upcoming bars without interrupting transport; replacing the active chord is audible immediately. */
  updateProgression(symbols: string[], currentIndexOverride?: number) {
    const previousCurrent = this.currentIndex >= 0 ? this.symbols[this.currentIndex] : undefined
    this.symbols = [...symbols]
    this.voicings = voiceChordProgression(this.symbols)
    if (currentIndexOverride !== undefined) {
      this.currentIndex = Math.max(0, Math.min(currentIndexOverride, this.symbols.length - 1))
      this.nextIndex = this.currentIndex + 1
    } else if (this.currentIndex >= this.symbols.length) this.currentIndex = this.symbols.length - 1
    this.nextIndex = Math.min(this.nextIndex, this.symbols.length)
    const current = this.currentIndex >= 0 ? this.symbols[this.currentIndex] : undefined
    if (this.active && current && current !== previousCurrent) {
      if (Tone.Transport.state === 'started') this.playIndex(this.currentIndex, Tone.now())
      else this.callbacks?.onChord(this.currentIndex, this.getSoundingMidi(this.currentIndex))
    }
  }

  setLoop(loop: boolean) { this.loop = loop }

  setChordDuration(duration: '4n' | '8n') { this.chordDuration = duration }

  setRootOctave(octave: number) {
    this.octaveShift = (octave - 3) * 12
    if (!this.active || this.currentIndex < 0) return
    if (Tone.Transport.state === 'started') this.playIndex(this.currentIndex, Tone.now())
    else this.callbacks?.onChord(this.currentIndex, this.getSoundingMidi(this.currentIndex))
  }

  resume() {
    if (!this.active) return
    if (this.currentIndex >= 0) this.playIndex(this.currentIndex, Tone.now())
    Tone.Transport.start()
  }

  pause() {
    Tone.Transport.pause()
  }

  stop() {
    this.active = false
    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    this.repeatEvent = null
    this.currentIndex = -1
    this.nextIndex = 0
    this.tickCount = 0
    this.symbols = []
    this.voicings = []
    this.synth?.releaseAll()
    this.callbacks = null
  }

  dispose() {
    this.stop()
    this.synth?.dispose()
    this.reverb?.dispose()
    this.filter?.dispose()
    this.synth = null
    this.reverb = null
    this.filter = null
  }

  private async ensureSynth() {
    if (this.synth) return
    if (!this.reverb) {
      this.reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.018, wet: 0.16 })
      await this.reverb.ready
      this.reverb.toDestination()
    }
    const settings = {
      sine: { volume: -11, oscillator: { type: 'sine' as const }, envelope: { attack: 0.06, decay: 0.24, sustain: 0.38, release: 0.72 } },
      triangle: { volume: -12, oscillator: { type: 'triangle' as const }, envelope: { attack: 0.035, decay: 0.2, sustain: 0.42, release: 0.6 } },
      piano: { volume: -13, oscillator: { type: 'triangle' as const, partials: [1, 0.55, 0.24, 0.1] }, envelope: { attack: 0.008, decay: 0.48, sustain: 0.08, release: 0.72 } },
      bass: { volume: -10, oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.025, decay: 0.22, sustain: 0.68, release: 0.4 } },
    }[this.soundPreset]
    this.synth = new Tone.PolySynth(Tone.Synth, settings)
    if (this.soundPreset === 'bass') {
      this.filter = new Tone.Filter(760, 'lowpass')
      this.synth.connect(this.filter)
      this.filter.connect(this.reverb)
    } else {
      this.synth.connect(this.reverb)
    }
  }

  private playIndex(index: number, time: number) {
    if (!this.active || !this.synth || !this.voicings[index]) return
    const soundingMidi = this.getSoundingMidi(index)
    const notes = soundingMidi.map(midiToToneNote)
    this.synth.releaseAll(time)
    this.synth.triggerAttack(notes, time, 0.24)
    this.currentIndex = index
    this.callbacks?.onChord(index, soundingMidi)
  }

  private getSoundingMidi(index: number) {
    return (this.voicings[index] ?? []).map(note => note + this.octaveShift)
  }
}
