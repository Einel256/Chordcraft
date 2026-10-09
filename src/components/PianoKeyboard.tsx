import { midiToToneNote } from '../audio/chordVoicing'

const BLACK_PITCHES = new Set([1, 3, 6, 8, 10])
const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export default function PianoKeyboard({ chordName, notes }: { chordName: string; notes: number[] }) {
  const lowest = notes.length ? Math.min(...notes) : 60
  const highest = notes.length ? Math.max(...notes) : 71
  const start = Math.floor(lowest / 12) * 12
  const end = Math.max(start + 35, Math.ceil((highest + 1) / 12) * 12 - 1)
  const allNotes = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  const whiteNotes = allNotes.filter(note => !BLACK_PITCHES.has(note % 12))
  const pressed = new Set(notes)
  const noteNames = notes.map(midiToToneNote).join(' · ')

  return <section className="keyboard-panel" aria-label="コードの構成音を鍵盤で表示">
    <div className="keyboard-heading"><span><strong>PIANO KEYS</strong><small>{chordName ? `${chordName} の構成音` : '選択中のコード'}</small></span><output>{noteNames || '—'}</output></div>
    <div className="piano-scroll"><div className="piano-keys" role="img" aria-label={`${chordName}の構成音: ${noteNames}`} style={{ width: `${whiteNotes.length * 32}px` }}>
      <div className="white-keys">{whiteNotes.map(note => <div className={`piano-key white-key ${pressed.has(note) ? 'pressed' : ''} ${note % 12 === 0 ? 'octave-key' : ''}`} key={note} title={midiToToneNote(note)}><span>{pitchNames[note % 12]}</span>{note % 12 === 0 && <small>{Math.floor(note / 12) - 1}</small>}</div>)}</div>
      <div className="black-keys">{allNotes.filter(note => BLACK_PITCHES.has(note % 12)).map(note => {
        const whiteIndex = whiteNotes.filter(white => white < note).length
        return <div className={`piano-key black-key ${pressed.has(note) ? 'pressed' : ''}`} key={note} style={{ left: `${whiteIndex * 32 - 9}px` }} title={midiToToneNote(note)} />
      })}</div>
    </div></div>
  </section>
}
