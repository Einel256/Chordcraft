import { useEffect, useMemo, useRef, useState } from 'react'
import { CHORD_ROOTS, generateProgression, getDiatonicChords, makeCustomChord, KEYS, transposeProgression, type Chord, type ChordModifier, type KeyName, type Settings } from './music/progression'
import { ChordPlayback, type SoundPreset } from './audio/playback'
import ChordLibrary from './components/ChordLibrary'
import ChordOptionsPopover from './components/ChordOptionsPopover'
import PianoKeyboard from './components/PianoKeyboard'
import { autoVoiceChordSymbols, parseChord, voiceChordProgression } from './audio/chordVoicing'

function Icon({ name }: { name: 'spark' | 'arrow' | 'music' | 'copy' }) {
  if (name === 'spark') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>
  if (name === 'arrow') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
  if (name === 'music') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
}

const roleLabels = { Tonic: 'トニック', Subdominant: 'サブドミナント', Dominant: 'ドミナント', Color: 'カラー' }
const initial: Settings = { key: 'C', count: 8, naturalness: 7, complexity: 5, surprise: 4 }
const importedRomanDegrees = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII']
type PresetChord = { offset: number; modifiers: ChordModifier[]; bassOffset?: number; suffix?: string; roman?: string }
type ProgressionPreset = { name: string; degrees: string; chords: PresetChord[] }
const progressionPresets: ProgressionPreset[] = [
  { name: '王道進行', degrees: 'IV – V – iii – vi', chords: [{ offset: 5, modifiers: [] }, { offset: 7, modifiers: [] }, { offset: 4, modifiers: ['m'] }, { offset: 9, modifiers: ['m'] }] },
  { name: 'カノン進行', degrees: 'I – V – vi – iii – IV – I – IV – V', chords: [{ offset: 0, modifiers: [] }, { offset: 7, modifiers: [] }, { offset: 9, modifiers: ['m'] }, { offset: 4, modifiers: ['m'] }, { offset: 5, modifiers: [] }, { offset: 0, modifiers: [] }, { offset: 5, modifiers: [] }, { offset: 7, modifiers: [] }] },
  { name: '小室進行', degrees: 'vi – IV – V – I', chords: [{ offset: 9, modifiers: ['m'] }, { offset: 5, modifiers: [] }, { offset: 7, modifiers: [] }, { offset: 0, modifiers: [] }] },
  { name: '丸サ進行', degrees: 'IVmaj7 – III7 – VIm7 – Vm7 – I7', chords: [{ offset: 5, modifiers: ['M'] }, { offset: 4, modifiers: ['7'] }, { offset: 9, modifiers: ['m', '7'] }, { offset: 7, modifiers: ['m', '7'] }, { offset: 0, modifiers: ['7'] }] },
  { name: 'IV–V–vi–I', degrees: 'IVmaj7 – V7 – vi7 – Imaj7', chords: [{ offset: 5, modifiers: ['M'] }, { offset: 7, modifiers: ['7'] }, { offset: 9, modifiers: ['m', '7'] }, { offset: 0, modifiers: ['M'] }] },
  { name: 'オンコード王道', degrees: 'IVmaj7 – V7/IV – iii7 – vi7', chords: [{ offset: 5, modifiers: ['M'] }, { offset: 7, modifiers: ['7'], bassOffset: 5 }, { offset: 4, modifiers: ['m', '7'] }, { offset: 9, modifiers: ['m', '7'] }] },
  { name: 'ポップパンク', degrees: 'I – V – vi – IV', chords: [{ offset: 0, modifiers: [] }, { offset: 7, modifiers: [] }, { offset: 9, modifiers: ['m'] }, { offset: 5, modifiers: [] }] },
  { name: '6251進行', degrees: 'vi7 – ii7 – V7 – Imaj7', chords: [{ offset: 9, modifiers: ['m', '7'] }, { offset: 2, modifiers: ['m', '7'] }, { offset: 7, modifiers: ['7'] }, { offset: 0, modifiers: ['M'] }] },
  { name: '6415進行', degrees: 'vi7 – IVmaj7 – Imaj7 – V7', chords: [{ offset: 9, modifiers: ['m', '7'] }, { offset: 5, modifiers: ['M'] }, { offset: 0, modifiers: ['M'] }, { offset: 7, modifiers: ['7'] }] },
  { name: '4156進行', degrees: 'Imaj7 – IVmaj7 – V7 – vi7', chords: [{ offset: 0, modifiers: ['M'] }, { offset: 5, modifiers: ['M'] }, { offset: 7, modifiers: ['7'] }, { offset: 9, modifiers: ['m', '7'] }] },
  { name: '枯葉進行', degrees: 'ii7 – V7 – Imaj7 – IVmaj7 – viiø7 – III7 – vi7', chords: [{ offset: 2, modifiers: ['m', '7'] }, { offset: 7, modifiers: ['7'] }, { offset: 0, modifiers: ['M'] }, { offset: 5, modifiers: ['M'] }, { offset: 11, modifiers: [], suffix: 'm7♭5', roman: 'viiø7' }, { offset: 4, modifiers: ['7'] }, { offset: 9, modifiers: ['m', '7'] }] },
  { name: 'コンファメ進行', degrees: 'Imaj7 – viiø7 – III7 – vi7 – v7 – I7 – IVmaj7', chords: [{ offset: 0, modifiers: ['M'] }, { offset: 11, modifiers: [], suffix: 'm7♭5', roman: 'viiø7' }, { offset: 4, modifiers: ['7'] }, { offset: 9, modifiers: ['m', '7'] }, { offset: 7, modifiers: ['m', '7'] }, { offset: 0, modifiers: ['7'] }, { offset: 5, modifiers: ['M'] }] },
  { name: '♯Vdim7経過', degrees: 'I – V7 – ♯Vdim7 – vi7 – IV', chords: [{ offset: 0, modifiers: [] }, { offset: 7, modifiers: ['7'] }, { offset: 8, modifiers: ['dim', '7'], roman: '♯Vdim7' }, { offset: 9, modifiers: ['m', '7'] }, { offset: 5, modifiers: [] }] },
  { name: 'ドッペルドミナント', degrees: 'vi7 – II7 – V7 – Imaj7', chords: [{ offset: 9, modifiers: ['m', '7'] }, { offset: 2, modifiers: ['7'] }, { offset: 7, modifiers: ['7'] }, { offset: 0, modifiers: ['M'] }] },
  { name: '♯IVø7ドミナント', degrees: 'vi7 – ♯ivø7 – V7 – Imaj7', chords: [{ offset: 9, modifiers: ['m', '7'] }, { offset: 6, modifiers: [], suffix: 'm7♭5', roman: '♯ivø7' }, { offset: 7, modifiers: ['7'] }, { offset: 0, modifiers: ['M'] }] },
  { name: 'マリオ進行', degrees: 'I/V – ♭VImaj7 – ♭VII7 – Imaj7', chords: [{ offset: 0, modifiers: [], bassOffset: 7 }, { offset: 8, modifiers: ['M'] }, { offset: 10, modifiers: ['7'] }, { offset: 0, modifiers: ['M'] }] },
  { name: 'サブドミナントマイナー', degrees: 'IV – iv/♭VI – I', chords: [{ offset: 5, modifiers: [] }, { offset: 5, modifiers: ['m'], bassOffset: 8 }, { offset: 0, modifiers: [] }] },
  { name: 'サブドミナントマイナー＋iii', degrees: 'IV – iii7 – iv/♭VI – I', chords: [{ offset: 5, modifiers: [] }, { offset: 4, modifiers: ['m', '7'] }, { offset: 5, modifiers: ['m'], bassOffset: 8 }, { offset: 0, modifiers: [] }] },
  { name: '偽終止・♯IVø7代用', degrees: 'V7 – ♯ivø7', chords: [{ offset: 7, modifiers: ['7'] }, { offset: 6, modifiers: [], suffix: 'm7♭5', roman: '♯ivø7' }] },
]

const majorScaleDegrees = [0, 2, 4, 5, 7, 9, 11]

function chordFromDegree(degree: number, key: KeyName, modifiers: ChordModifier[] = []): Chord {
  const tonic = KEYS.indexOf(key)
  const offset = degree - 1
  const root = KEYS[(tonic + majorScaleDegrees[offset % 7] + Math.floor(offset / 7) * 12) % 12]
  const defaultQuality: ChordModifier[] = offset % 7 === 1 || offset % 7 === 2 || offset % 7 === 5 ? ['m'] : offset % 7 === 6 ? ['dim'] : []
  return makeCustomChord(key, root, modifiers.length ? modifiers : defaultQuality)
}

function chordFromRoman(token: string, key: KeyName): Chord | undefined {
  const match = token.match(/^(♭|b|#)?(vii|vi|iv|iii|ii|v|i)(°|dim|maj7|M7|m7|7|sus2|sus4)?$/i)
  if (!match) return undefined
  const [, accidental = '', roman, suffix = ''] = match
  const degree = ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 } as Record<string, number>)[roman.toUpperCase()]
  const index = degree - 1
  const rootPitch = (KEYS.indexOf(key) + majorScaleDegrees[index] + (accidental === '#' ? 1 : accidental ? 11 : 0)) % 12
  const root = KEYS[rootPitch]
  const isLower = roman === roman.toLowerCase()
  let modifiers: ChordModifier[] = suffix === '°' || suffix === 'dim' ? ['dim'] : suffix === 'maj7' || suffix === 'M7' ? ['M'] : suffix === 'm7' ? ['m', '7'] : suffix === '7' ? ['7'] : suffix === 'sus2' ? ['sus2'] : suffix === 'sus4' ? ['sus4'] : isLower ? ['m'] : []
  if (degree === 7 && !suffix) modifiers = ['dim']
  if (suffix === '7' && isLower) modifiers = ['m', '7']
  return makeCustomChord(key, root, modifiers)
}

function chordFromInput(symbol: string, key: KeyName): Chord {
  const romanChord = chordFromRoman(symbol, key)
  if (romanChord) return romanChord
  const parsed = parseChord(symbol)
  const rootDelta = (parsed.root - KEYS.indexOf(key) + 12) % 12
  let numeral = importedRomanDegrees[rootDelta]
  const quality = symbol.replace(/^[A-G](?:#|b|♯|♭)?/, '').split('/')[0]
  const isMinor = /m(?!aj)/.test(quality)
  const isDiminished = /dim|°/.test(quality)
  if (isMinor || isDiminished) numeral = numeral.replace(/[IV]+$/, value => value.toLowerCase())
  let suffix = ''
  if (isDiminished) suffix += '°'
  else if (/maj7|M7/.test(quality)) suffix += 'maj⁷'
  else if (/7/.test(quality)) suffix += '⁷'
  if (/sus2/.test(quality)) suffix += 'sus²'
  else if (/sus4|sus/.test(quality)) suffix += 'sus⁴'
  if (/add9/.test(quality)) suffix += 'add9'
  if (/add11/.test(quality)) suffix += 'add11'
  if (/add13/.test(quality)) suffix += 'add13'
  const diatonicDegree = [0, 2, 4, 5, 7, 9, 11].indexOf(rootDelta)
  const role: Chord['role'] = diatonicDegree < 0 ? 'Color' : [0, 2, 5].includes(diatonicDegree) ? 'Tonic' : [1, 3].includes(diatonicDegree) ? 'Subdominant' : 'Dominant'
  return { symbol, roman: `${numeral}${suffix}`, role, pitch: parsed.root, notes: parsed.pitchClasses, bass: parsed.bass }
}

function modifiersFromSymbol(symbol: string): ChordModifier[] {
  const suffix = symbol.replace(/^[A-G](?:#|b|♯|♭)?/, '').split('/')[0].replace(/[()]/g, '')
  const modifiers: ChordModifier[] = []
  if (suffix.includes('dim')) modifiers.push('dim')
  else if (suffix.includes('aug')) modifiers.push('aug')
  else if (suffix.includes('sus2')) modifiers.push('sus2')
  else if (suffix.includes('sus4')) modifiers.push('sus4')
  else if (/^m(?!aj)/.test(suffix)) modifiers.push('m')
  if (suffix.includes('mM7')) modifiers.push('M')
  else if (suffix.includes('maj7')) modifiers.push('M')
  else if (suffix.includes('dim7') || suffix.includes('m7') || suffix.includes('aug7') || /sus[24]7/.test(suffix) || /^7/.test(suffix)) modifiers.push('7')
  if (suffix === '6' || suffix.endsWith('m6') || suffix.includes('add6')) modifiers.push('6')
  if (suffix === '9' || suffix === '11' || suffix === '13') modifiers.push('7')
  if (['m9', 'm11', 'm13'].includes(suffix)) modifiers.push('7')
  if (/^(?:maj|m)?(?:9|11|13)$/.test(suffix) && suffix.startsWith('maj')) modifiers.push('M')
  if (/^(?:maj|m)?(?:9|11|13)$/.test(suffix) && suffix.startsWith('m')) modifiers.push('m')
  if (suffix.includes('add9') || ['9', 'maj9', 'm9', '11', 'maj11', 'm11', '13', 'maj13', 'm13'].includes(suffix)) modifiers.push('add9')
  if (suffix.includes('add11') || ['11', 'maj11', 'm11', '13', 'maj13', 'm13'].includes(suffix)) modifiers.push('add11')
  if (suffix.includes('add13') || ['13', 'maj13', 'm13'].includes(suffix)) modifiers.push('add13')
  return modifiers
}

function App() {
  const [settings, setSettings] = useState<Settings>(initial)
  const [progression, setProgression] = useState<Chord[]>(() => generateProgression(initial))
  const [generated, setGenerated] = useState(1)
  const [copied, setCopied] = useState(false)
  const [bpm, setBpm] = useState(96)
  const [rootOctave, setRootOctave] = useState(3)
  const [chordDuration, setChordDuration] = useState<'4n' | '8n'>('4n')
  const [transposeKey, setTransposeKey] = useState<KeyName>(initial.key)
  const [progressionInput, setProgressionInput] = useState('')
  const [progressionInputError, setProgressionInputError] = useState('')
  const [showAllPresets, setShowAllPresets] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [playbackState, setPlaybackState] = useState<'stopped' | 'playing' | 'paused'>('stopped')
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [playingMidiNotes, setPlayingMidiNotes] = useState<number[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [customRoot, setCustomRoot] = useState<KeyName>(() => CHORD_ROOTS[progression[0].pitch])
  const [customModifiers, setCustomModifiers] = useState<ChordModifier[]>(() => modifiersFromSymbol(progression[0].symbol))
  const [soundPreset, setSoundPreset] = useState<SoundPreset>('sine')
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [customInversion, setCustomInversion] = useState(0)
  const [customSlashBass, setCustomSlashBass] = useState<number | undefined>(undefined)
  const [playbackError, setPlaybackError] = useState('')
  const playbackRef = useRef<ChordPlayback | null>(null)
  useEffect(() => () => playbackRef.current?.dispose(), [])
  useEffect(() => {
    const chord = progression[selectedIndex]
    if (!chord) return
    setCustomRoot(CHORD_ROOTS[chord.pitch])
    setCustomModifiers(modifiersFromSymbol(chord.symbol))
    try {
      const parsed = parseChord(chord.symbol)
      const chordToneInversion = parsed.bass === undefined ? -1 : parsed.pitchClasses.indexOf(parsed.bass)
      setCustomInversion(chordToneInversion >= 0 ? chordToneInversion : 0)
      setCustomSlashBass(parsed.bass !== undefined && chordToneInversion < 0 ? parsed.bass : undefined)
    } catch {
      setCustomInversion(0)
      setCustomSlashBass(undefined)
    }
  }, [progression, selectedIndex])
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }))
  const generate = () => {
    playbackRef.current?.stop()
    setPlaybackState('stopped'); setPlayingIndex(null); setPlayingMidiNotes(null); setPlaybackError('')
    setProgression(generateProgression(settings)); setGenerated(n => n + 1); setSelectedIndex(0); setEditingIndex(null); setCopied(false)
  }
  const transposeToSelectedKey = () => {
    const next = transposeProgression(progression, settings.key, transposeKey)
    editProgression(next, selectedIndex)
    setSettings(current => ({ ...current, key: transposeKey }))
  }
  const previewChord = async (index: number) => {
    setPlaybackError('')
    setSelectedIndex(index)
    if (!playbackRef.current) playbackRef.current = new ChordPlayback()
    try {
      await playbackRef.current.preview(progression[index].symbol, rootOctave)
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'コードを試聴できませんでした')
    }
  }
  const importProgression = () => {
    const input = progressionInput.trim()
    const tokens = /^[1-7]{1,16}$/.test(input) ? [...input] : input.split(/\s*(?:→|➜|->|,|;|\||\n)\s*|\s+/).filter(Boolean)
    if (!tokens.length) { setProgressionInputError('コード進行を入力してください'); return }
    if (tokens.length > 16) { setProgressionInputError('一度に配置できるコードは16個までです'); return }
    try {
      const next = tokens.map(token => /^[1-7]$/.test(token) ? chordFromDegree(Number(token), settings.key) : chordFromInput(token, settings.key))
      editProgression(next, 0)
      setEditingIndex(null)
      setProgressionInputError('')
    } catch {
      setProgressionInputError('コード名を読み取れませんでした。例: Gsus2/D → Asus4/E → Bm7/F♯')
    }
  }
  const editProgression = (next: Chord[], nextSelected: number, nextPlayingIndex?: number) => {
    if (playbackState !== 'stopped') {
      playbackRef.current?.updateProgression(next.map(chord => chord.symbol), nextPlayingIndex)
      if (nextPlayingIndex !== undefined) setPlayingIndex(nextPlayingIndex)
    } else {
      playbackRef.current?.stop()
      setPlayingIndex(null); setPlayingMidiNotes(null)
    }
    setPlaybackError('')
    setProgression(next); setSelectedIndex(nextSelected); setCopied(false)
  }
  const applyLibraryChord = (chordIndex: number) => {
    const chord = getDiatonicChords(settings.key)[chordIndex]
    editProgression(progression.map((current, index) => index === selectedIndex ? chord : current), selectedIndex)
  }
  const insertLibraryChord = (chordIndex: number) => {
    if (progression.length >= 16) return
    const next = [...progression]
    next.splice(selectedIndex + 1, 0, getDiatonicChords(settings.key)[chordIndex])
    editProgression(next, selectedIndex + 1)
  }
  const applyCustomChordValues = (root: KeyName, modifiers: ChordModifier[], inversion: number, slashBass: number | undefined) => {
    setCustomRoot(root)
    setCustomModifiers(modifiers)
    setCustomInversion(inversion)
    setCustomSlashBass(slashBass)
    const chord = makeCustomChord(settings.key, root, modifiers, { inversion, slashBass })
    editProgression(progression.map((current, index) => index === selectedIndex ? chord : current), selectedIndex)
  }
  const addChord = () => {
    if (progression.length >= 16) return
    const next = [...progression, getDiatonicChords(settings.key)[0]]
    editProgression(next, next.length - 1)
    setEditingIndex(next.length - 1)
  }
  const removeChord = (index = selectedIndex) => {
    if (progression.length <= 1) return
    const next = progression.filter((_, chordIndex) => chordIndex !== index)
    const nextSelected = selectedIndex > index ? selectedIndex - 1 : Math.min(selectedIndex, next.length - 1)
    editProgression(next, nextSelected)
    setEditingIndex(null)
  }
  const moveChord = (offset: -1 | 1) => {
    const destination = selectedIndex + offset
    if (destination < 0 || destination >= progression.length) return
    const next = [...progression]
    ;[next[selectedIndex], next[destination]] = [next[destination], next[selectedIndex]]
    editProgression(next, destination)
  }
  const play = async () => {
    setPlaybackError('')
    if (playbackState === 'paused') {
      playbackRef.current?.resume(); setPlaybackState('playing'); return
    }
    if (!playbackRef.current) playbackRef.current = new ChordPlayback()
    setPlaybackState('playing')
    try {
      await playbackRef.current.start(progression.map(chord => chord.symbol), bpm, {
        onChord: (index, soundingMidi) => { setPlayingIndex(index); setPlayingMidiNotes(soundingMidi) },
        onEnd: () => { setPlaybackState('stopped'); setPlayingIndex(null); setPlayingMidiNotes(null) },
      }, loopEnabled, rootOctave, chordDuration)
    } catch (error) {
      setPlaybackState('stopped'); setPlayingIndex(null); setPlayingMidiNotes(null)
      setPlaybackError(error instanceof Error ? error.message : '音声を開始できませんでした')
    }
  }
  const pause = () => { playbackRef.current?.pause(); setPlaybackState('paused') }
  const stop = () => { playbackRef.current?.stop(); setPlaybackState('stopped'); setPlayingIndex(null); setPlayingMidiNotes(null) }
  const changeBpm = (value: number) => { setBpm(value); playbackRef.current?.setBpm(value) }
  const changeRootOctave = (value: number) => { setRootOctave(value); playbackRef.current?.setRootOctave(value) }
  const changeChordDuration = (value: '4n' | '8n') => { setChordDuration(value); playbackRef.current?.setChordDuration(value) }
  const changeLoop = (enabled: boolean) => { setLoopEnabled(enabled); playbackRef.current?.setLoop(enabled) }
  const previewSymbol = async (symbol: string) => {
    setPlaybackError('')
    if (!playbackRef.current) playbackRef.current = new ChordPlayback()
    try {
      await playbackRef.current.preview(symbol, rootOctave)
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'コードを試聴できませんでした')
    }
  }
  const applyPreset = (presetIndex: number) => {
    const preset = progressionPresets[presetIndex]
    const tonic = KEYS.indexOf(settings.key)
    const chords = preset.chords.map(item => {
      const root = KEYS[(tonic + item.offset) % 12]
      if (item.suffix) {
        const chord = chordFromInput(`${root}${item.suffix}`, settings.key)
        return { ...chord, roman: item.roman ?? chord.roman }
      }
      const slashBass = item.bassOffset === undefined ? undefined : (tonic + item.bassOffset) % 12
      const chord = makeCustomChord(settings.key, root, item.modifiers, { slashBass })
      return { ...chord, roman: item.roman ?? chord.roman }
    })
    editProgression(chords, 0)
    setEditingIndex(null)
  }
  const applyAutomaticVoicings = () => {
    const symbols = autoVoiceChordSymbols(progression.map(chord => chord.symbol))
    const next = progression.map((chord, index) => {
      const parsed = parseChord(symbols[index])
      return { ...chord, symbol: symbols[index], bass: parsed.bass, inversion: parsed.bass === undefined ? 0 : Math.max(0, parsed.pitchClasses.indexOf(parsed.bass)) }
    })
    editProgression(next, selectedIndex)
  }
  const reorderChords = (from: number, to: number) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0 || from >= progression.length || to >= progression.length) return
    const next = [...progression]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const nextSelected = selectedIndex === from ? to : from < selectedIndex && to >= selectedIndex ? selectedIndex - 1 : from > selectedIndex && to <= selectedIndex ? selectedIndex + 1 : selectedIndex
    const nextPlaying = playingIndex === null ? undefined : playingIndex === from ? to : from < playingIndex && to >= playingIndex ? playingIndex - 1 : from > playingIndex && to <= playingIndex ? playingIndex + 1 : playingIndex
    editProgression(next, nextSelected, nextPlaying)
  }
  const changeSound = (value: SoundPreset) => {
    if (playbackState !== 'stopped') stop()
    playbackRef.current?.setSound(value)
    setSoundPreset(value)
  }
  const voicings = useMemo(() => voiceChordProgression(progression.map(chord => chord.symbol)), [progression])
  const keyboardIndex = playingIndex ?? selectedIndex
  const audibleNotes = playbackState !== 'stopped' && playingMidiNotes
    ? playingMidiNotes
    : (voicings[keyboardIndex] ?? []).map(note => note + (rootOctave - 3) * 12)
  const copy = async () => {
    await navigator.clipboard.writeText(progression.map(chord => chord.symbol).join('  →  '))
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Chordcraft ホーム"><span className="brand-mark"><Icon name="music" /></span><span>chordcraft<span className="brand-dot">.</span></span></a>
      <div className="topbar-right"><span className="beta"><span className="live-dot" />MVP / BETA</span><span className="top-divider" /><span className="edition">COMPOSER'S TOOLKIT&nbsp; 01</span></div>
    </header>

    <section className="hero" id="top">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" />IDEAS, IN HARMONY</div><h1>次の一音に、<br /><span>出会う。</span></h1><p>音楽理論と偶然が交差する、コード進行ジェネレーター。<br className="desktop-break" />自然な流れの中に、思いがけない響きを見つけよう。</p></div>
      <div className="hero-note" aria-hidden="true"><span className="note-orbit orbit-one" /><span className="note-orbit orbit-two" /><span className="note-core">♪</span><span className="note-label">HARMONY<br />EXPLORER</span></div>
    </section>

    <section className="workspace" aria-label="コード進行ジェネレーター">
      <aside className="controls panel">
        <div className="panel-heading"><span className="section-index">01</span><div><h2>進行をデザイン</h2><p>好みの響きを設定してください</p></div></div>
        <div className="control-group key-control"><label htmlFor="key-select">KEY <span>調性</span></label><div className="select-wrap"><select id="key-select" value={settings.key} onChange={event => update('key', event.target.value as KeyName)}>{KEYS.map(key => <option key={key} value={key}>{key} major</option>)}</select><span className="select-chevron">⌄</span></div></div>
        <div className="control-group"><div className="label-row"><label>CHORDS <span>コード数</span></label><span className="choice-hint">BAR COUNT</span></div><div className="segmented">{([4, 8, 16] as const).map(count => <button key={count} className={settings.count === count ? 'segment active' : 'segment'} onClick={() => update('count', count)}>{count}<small> bars</small></button>)}</div></div>
        <div className="controls-divider" />
        <div className="sliders-title"><span>CHARACTER</span><span>音楽の個性</span></div>
        <Slider label="自然さ" sub="NATURALNESS" value={settings.naturalness} color="mint" onChange={value => update('naturalness', value)} />
        <Slider label="複雑さ" sub="COMPLEXITY" value={settings.complexity} color="violet" onChange={value => update('complexity', value)} />
        <Slider label="意外性" sub="SURPRISE" value={settings.surprise} color="amber" onChange={value => update('surprise', value)} />
        <div className="theory-hint"><span className="hint-icon">✳</span><p><strong>理論のヒント</strong>自然さを上げると機能和声を重視。意外性を上げると借用和音やセカンダリードミナントが増えます。</p></div>
        <button className="generate-button" onClick={generate}><Icon name="spark" /><span>進行を生成</span><Icon name="arrow" /></button>
        <div className="generate-footnote"><span>✦</span> あなただけの響きを見つけよう</div>
        <div className="preset-progressions"><h3>定番進行から選ぶ</h3><div>{progressionPresets.slice(0, showAllPresets ? progressionPresets.length : 4).map((preset, index) => <button type="button" key={preset.name} onClick={() => applyPreset(index)}><strong>{preset.name}</strong><small>{preset.degrees}</small></button>)}</div><button type="button" className="preset-toggle" onClick={() => setShowAllPresets(value => !value)}>{showAllPresets ? '閉じる' : `すべて表示（${progressionPresets.length}）`}</button></div>
      </aside>

      <section className="result panel" aria-live="polite">
        <div className="result-top"><div className="panel-heading result-heading"><span className="section-index">02</span><div><h2>コード進行を編集</h2><p><span className="key-badge">{settings.key} MAJOR</span><span className="meta-separator">·</span>{progression.length} chords</p></div></div><button className="icon-button" onClick={copy} aria-label="コード進行をコピー"><Icon name="copy" /><span>{copied ? 'COPIED' : 'COPY'}</span></button></div>
        <div className="result-rule"><span>YOUR PROGRESSION</span><span>#{String(generated).padStart(3, '0')}</span></div>
        <div className="transpose-toolbar"><div><span className="transpose-label">KEY TRANSPOSE</span><span className="transpose-from">{settings.key} →</span><select aria-label="移調先のキー" value={transposeKey} onChange={event => setTransposeKey(event.target.value as KeyName)}>{KEYS.map(key => <option key={key} value={key}>{key} major</option>)}</select><button type="button" onClick={transposeToSelectedKey}>このキーに移調</button></div><small>ディグリーネームを保って進行全体を移調</small></div>
        <div className="edit-toolbar"><span><i className="selection-indicator" />小節を選択 · ドラッグで並べ替え</span><div><button className="auto-voicing-button" onClick={applyAutomaticVoicings} title="声部の移動が滑らかになる転回形を全コードに設定">自動ボイシング</button><button onClick={() => moveChord(-1)} disabled={selectedIndex === 0} aria-label="コードを前へ移動" title="前へ移動">↑</button><button onClick={() => moveChord(1)} disabled={selectedIndex === progression.length - 1} aria-label="コードを後ろへ移動" title="後ろへ移動">↓</button></div></div>
        <div className="transport"><div className="transport-buttons"><button className={`transport-button play-button ${playbackState === 'playing' ? 'is-playing' : ''}`} onClick={play} disabled={playbackState === 'playing'} aria-label={playbackState === 'paused' ? '再生を再開' : '再生'}>▶<span>{playbackState === 'paused' ? '再開' : '再生'}</span></button><button className="transport-button" onClick={pause} disabled={playbackState !== 'playing'} aria-label="一時停止">Ⅱ<span>一時停止</span></button><button className="transport-button" onClick={stop} disabled={playbackState === 'stopped'} aria-label="停止">■<span>停止</span></button><button type="button" className={`transport-button loop-button ${loopEnabled ? 'loop-active' : ''}`} aria-pressed={loopEnabled} onClick={() => changeLoop(!loopEnabled)}>↻<span>ループ</span></button></div><label className="bpm-control"><span className="bpm-caption">TEMPO</span><input aria-label={`BPM ${bpm}`} type="range" min="40" max="200" value={bpm} style={{ '--bpm-progress': `${((bpm - 40) / 160) * 100}%` } as React.CSSProperties} onChange={event => changeBpm(Number(event.target.value))} /><output>{bpm}<small> BPM</small></output></label><label className="sound-control"><span>コード長</span><select aria-label="コードの長さ" value={chordDuration} onChange={event => changeChordDuration(event.target.value as '4n' | '8n')}><option value="4n">四分音符</option><option value="8n">八分音符</option></select></label><label className="sound-control"><span>ルートoct</span><select aria-label="ルート音のオクターブ" value={rootOctave} onChange={event => changeRootOctave(Number(event.target.value))}><option value={3}>C3 基準</option><option value={4}>C4 基準</option><option value={5}>C5 基準</option></select></label><label className="sound-control"><span>音色</span><select value={soundPreset} onChange={event => changeSound(event.target.value as SoundPreset)}><option value="sine">正弦波</option><option value="triangle">三角波</option><option value="piano">ピアノ風</option><option value="bass">ベース風</option></select></label></div>
        {playbackError && <p className="playback-error" role="alert">音声を開始できませんでした。ブラウザの音声設定をご確認ください。</p>}
        <PianoKeyboard chordName={progression[keyboardIndex]?.symbol ?? ''} notes={audibleNotes} />
        <div className={`chord-grid count-${progression.length}`}>{progression.map((chord, index) => <div className={`chord-card ${playingIndex === index ? 'is-current' : ''} ${selectedIndex === index ? 'is-selected' : ''} ${editingIndex === index ? 'has-editor' : ''} ${draggingIndex === index ? 'is-dragging' : ''} ${dropIndex === index ? 'is-drop-target' : ''}`} key={`${generated}-${index}`} style={{ animationDelay: `${index * 45}ms` }} onDragOver={event => { event.preventDefault(); setDropIndex(index) }} onDrop={event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); reorderChords(from, index); setDraggingIndex(null); setDropIndex(null) }}>
          <button type="button" className="chord-card-select" draggable onDragStart={event => { event.dataTransfer.setData('text/plain', String(index)); event.dataTransfer.effectAllowed = 'move'; setDraggingIndex(index) }} onDragEnd={() => { setDraggingIndex(null); setDropIndex(null) }} aria-label={`${index + 1}小節目、ドラッグで並べ替え`} aria-current={playingIndex === index ? 'true' : undefined} aria-pressed={selectedIndex === index} onClick={() => { setSelectedIndex(index); setEditingIndex(null) }}><span className="card-top"><span className="card-number">{String(index + 1).padStart(2, '0')}</span><span className={`role-dot role-${chord.role.toLowerCase()}`} /></span><span className="chord-name">{chord.symbol}</span><span className="roman">{chord.roman}</span><span className="card-bottom"><span className={`role-label role-text-${chord.role.toLowerCase()}`}>{roleLabels[chord.role]}</span><span className="card-arrow">{index < progression.length - 1 ? '↗' : '○'}</span></span></button>
          <button type="button" className="chord-preview-trigger" aria-label={`${chord.symbol}を試聴`} title="このコードを試聴" onClick={() => void previewChord(index)}>▶</button>
          <button type="button" className="chord-edit-trigger" aria-label={`${index + 1}小節目のコードを編集`} aria-expanded={editingIndex === index} onClick={() => { setSelectedIndex(index); setEditingIndex(editingIndex === index ? null : index) }}>✎ 編集</button>
          <button type="button" className="chord-delete-trigger" aria-label={`${index + 1}小節目のコードを削除`} title="このコードを削除" disabled={progression.length <= 1} onClick={() => removeChord(index)}>削除</button>
          {editingIndex === index && <ChordOptionsPopover keyName={settings.key} root={customRoot} modifiers={customModifiers} inversion={customInversion} slashBass={customSlashBass}
            onRootChange={root => applyCustomChordValues(root, customModifiers, customInversion, customSlashBass)}
            onModifiersChange={modifiers => applyCustomChordValues(customRoot, modifiers, customInversion, customSlashBass)}
            onInversionChange={inversion => applyCustomChordValues(customRoot, customModifiers, inversion, undefined)}
            onSlashBassChange={bass => applyCustomChordValues(customRoot, customModifiers, customInversion, bass)}
            onClose={() => setEditingIndex(null)} />}
        </div>)}{progression.length < 16 && <button type="button" className="chord-add-card" onClick={addChord}><span>＋</span><strong>コード追加</strong><small>次の小節に追加</small></button>}</div>
        <div className="progression-import"><div><strong>コード進行を入力</strong><small>矢印・空白・カンマ区切り、コード名・ディグリー・数字列に対応します。</small></div><textarea aria-label="配置するコード進行" value={progressionInput} onChange={event => setProgressionInput(event.target.value)} placeholder="Gsus2/D → Asus4/E → Bm7/F♯  または  4361" rows={2} /><button type="button" onClick={importProgression}>入力した進行を配置</button>{progressionInputError && <p role="alert">{progressionInputError}</p>}</div>
        <div className="result-bottom"><div className="legend"><span><i className="legend-dot tonic" />トニック</span><span><i className="legend-dot predominant" />サブドミナント</span><span><i className="legend-dot dominant" />ドミナント</span><span><i className="legend-dot color" />カラー</span></div><span className="progression-count">{String(progression.length).padStart(2, '0')} CHORDS <span>—</span> {settings.key} MAJOR</span></div>
        <div className="inspiration"><span className="inspiration-mark">“</span><p>理論は地図、音楽は旅。<br /><span>心に響く進行を見つけたら、そこから始めよう。</span></p><span className="inspiration-spark">✳</span></div>
      </section>
    </section>
    <ChordLibrary keyName={settings.key} selectedIndex={selectedIndex} onApply={applyLibraryChord} onInsert={insertLibraryChord} onPreview={index => void previewSymbol(getDiatonicChords(settings.key)[index].symbol)} />
    <footer><span>CHORDCRAFT <i>©</i> 2026</span><span>MADE FOR THE LOVE OF MUSIC <i>♪</i></span><span>HARMONY, REIMAGINED.</span></footer>
  </main>
}

function Slider({ label, sub, value, color, onChange }: { label: string; sub: string; value: number; color: string; onChange: (value: number) => void }) {
  return <div className={`slider-control ${color}`}><div className="slider-label"><span>{label}<small>{sub}</small></span><output>{String(value).padStart(2, '0')}<small>/10</small></output></div><input aria-label={`${label} ${value}`} type="range" min="0" max="10" value={value} style={{ '--range-progress': `${value * 10}%` } as React.CSSProperties} onChange={event => onChange(Number(event.target.value))} /><div className="range-ends"><span>LOW</span><span>HIGH</span></div></div>
}

export default App
