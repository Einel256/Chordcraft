const NOTE_PITCH: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export type ParsedChord = { root: number; intervals: number[]; pitchClasses: number[]; bass?: number }

function notePitch(note: string): number {
  const normalized = note.replace('♯', '#').replace('♭', 'b')
  const pitch = NOTE_PITCH[normalized]
  if (pitch === undefined) throw new Error(`Unsupported note: ${note}`)
  return pitch
}

/** Convert common chord symbols into pitch classes. No audio/UI dependency. */
export function parseChord(symbol: string): ParsedChord {
  const match = symbol.trim().match(/^([A-G](?:#|b|♯|♭)?)(.*?)(?:\/([A-G](?:#|b|♯|♭)?))?$/)
  if (!match) throw new Error(`Invalid chord symbol: ${symbol}`)
  const [, rootName, rawQuality, bassName] = match
  const root = notePitch(rootName)
  const quality = rawQuality.replace(/[()\s]/g, '').replace(/♭/g, 'b').replace(/♯/g, '#')
  let intervals: number[]

  if (/dim|°/.test(quality)) intervals = /(?:dim7|°7)/.test(quality) ? [0, 3, 6, 9] : [0, 3, 6]
  else if (/sus2/.test(quality)) intervals = [0, 2, 7]
  else if (/sus4|sus/.test(quality)) intervals = [0, 5, 7]
  else if (/aug|\+/.test(quality)) intervals = [0, 4, 8]
  else if (/m(?!aj)/.test(quality)) intervals = [0, 3, 7]
  else intervals = [0, 4, 7]

  const isMinor = /m(?!aj)/.test(quality)
  const isMajor7 = /maj(?:7|9|11|13)|M(?:7|9|11|13)/.test(quality)
  const has7 = /(?:maj(?:7|9|11|13)|M(?:7|9|11|13)|m7|dim7|aug7|°7|(^|[^a-z])7)/i.test(quality)
  const extension = quality.match(/(?<![a-z#b])(?:maj|M|m)?(13|11|9)(?!\d)/)?.[1]
  if (has7) intervals.push(isMajor7 ? 11 : /dim7|°7/.test(quality) ? 9 : 10)
  if (extension) {
    if (!has7) intervals.push(10)
    if (Number(extension) >= 9) intervals.push(14)
    if (Number(extension) >= 11) intervals.push(17)
    if (Number(extension) >= 13) intervals.push(21)
  }
  if (/add9/.test(quality) && !intervals.includes(14)) intervals.push(14)
  if (/add11/.test(quality)) intervals.push(17)
  if (/add13/.test(quality)) intervals.push(21)
  if (/m6/.test(quality)) intervals.push(9)
  if (/^6$/.test(quality) || /add6/.test(quality)) intervals.push(9)
  if (/b5/.test(quality)) intervals = intervals.map(interval => interval === 7 ? 6 : interval)
  if (/#5/.test(quality)) intervals = intervals.map(interval => interval === 7 ? 8 : interval)
  if (/b9/.test(quality)) intervals.push(13)
  if (/#9/.test(quality)) intervals.push(15)
  if (/#11/.test(quality)) intervals.push(18)
  if (/b11/.test(quality)) intervals.push(16)
  if (/b13/.test(quality)) intervals.push(20)
  if (isMinor && /maj7/.test(quality)) intervals = intervals.filter(interval => interval !== 10)

  return {
    root,
    intervals: [...new Set(intervals)],
    pitchClasses: [...new Set(intervals.map(interval => (root + interval) % 12))],
    bass: bassName ? notePitch(bassName) : undefined,
  }
}

function voicingCandidates(chord: ParsedChord, allowInversions = false): number[][] {
  const candidates: number[][] = []
  // C3 (MIDI 48) is the lowest allowed reference. A C major triad is
  // therefore voiced C3–E3–G3; no generated voicing can dip below C3.
  const rootMidi = 48 + chord.root
  // Root position is the default. Use another chord tone in the bass only
  // when the symbol explicitly carries a slash bass.
  const bassOptions = chord.bass === undefined ? (allowInversions ? chord.pitchClasses : [chord.root]) : [chord.bass]
  for (const bassPitch of bassOptions) {
    for (const octave of [-12, 0, 12]) {
      const chordRoot = rootMidi + octave
      let bass = chordRoot + ((bassPitch - chord.root + 12) % 12)
      while (bass < 48) bass += 12
      const notes = [bass]
      for (const interval of chord.intervals) {
        if ((chord.root + interval) % 12 === bassPitch) continue
        let note = chordRoot + interval
        while (note <= bass) note += 12
        notes.push(note)
      }
      const voicing = [...new Set(notes)].sort((a, b) => a - b)
      // Keep the bass in a narrow, repeatable register so regenerated/live-edited
      // progressions cannot jump an octave just because the previous chord changed.
      if (bass >= 48 && bass <= 60 && voicing[voicing.length - 1] <= 91) candidates.push(voicing)
    }
  }
  return candidates.length ? candidates : [[rootMidi, ...chord.intervals.slice(1).map(interval => rootMidi + interval)]]
}

function movementCost(previous: number[], next: number[]): number {
  let cost = Math.abs(previous[0] - next[0]) * 1.35
  const voices = Math.max(previous.length, next.length)
  for (let index = 0; index < voices; index++) {
    const from = previous[Math.min(index, previous.length - 1)]
    const to = next[Math.min(index, next.length - 1)]
    const distance = Math.abs(from - to)
    cost += distance + Math.max(0, distance - 7) * 0.8
  }
  return cost / (voices + 1)
}

/** Choose octave/inversion-compatible voicings that keep adjacent voices moving smoothly. */
export function voiceChordProgression(symbols: string[], allowInversions = false): number[][] {
  let previous: number[] | undefined
  return symbols.map(symbol => {
    const chord = parseChord(symbol)
    const candidates = voicingCandidates(chord, allowInversions)
    const notes = previous
      ? candidates.reduce((best, candidate) => movementCost(previous!, candidate) < movementCost(previous!, best) ? candidate : best)
      : candidates.reduce((best, candidate) => Math.abs(candidate[0] - (48 + chord.root)) < Math.abs(best[0] - (48 + chord.root)) ? candidate : best)
    previous = notes
    return notes
  })
}

/** Add slash basses for the smoothest available chord-tone inversions. */
export function autoVoiceChordSymbols(symbols: string[]): string[] {
  const rootsOnly = symbols.map(symbol => symbol.replace(/\/[A-G](?:#|b|♯|♭)?$/, ''))
  const voicings = voiceChordProgression(rootsOnly, true)
  return rootsOnly.map((symbol, index) => {
    const bass = voicings[index]?.[0] % 12
    const chord = parseChord(symbol)
    return bass === chord.root ? symbol : `${symbol}/${CHROMATIC[bass]}`
  })
}

export function midiToToneNote(midi: number): string {
  return `${CHROMATIC[midi % 12]}${Math.floor(midi / 12) - 1}`
}
