import { useEffect, useRef } from 'react'
import { CHORD_MODIFIERS, CHORD_ROOTS, makeCustomChord, type ChordModifier, type KeyName } from '../music/progression'

export default function ChordOptionsPopover({ keyName, root, modifiers, inversion, slashBass, onRootChange, onModifiersChange, onInversionChange, onSlashBassChange, onClose }: {
  keyName: KeyName
  root: KeyName
  modifiers: ChordModifier[]
  inversion: number
  slashBass: number | undefined
  onRootChange: (root: KeyName) => void
  onModifiersChange: (modifiers: ChordModifier[]) => void
  onInversionChange: (inversion: number) => void
  onSlashBassChange: (bass: number | undefined) => void
  onClose: () => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !editorRef.current?.contains(event.target)) onClose()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [onClose])

  const preview = makeCustomChord(keyName, root, modifiers, { inversion, slashBass })
  const toneNames = preview.notes.map(note => CHORD_ROOTS[note])
  const toggle = (modifier: ChordModifier, checked: boolean) => {
    let next = checked ? [...modifiers, modifier] : modifiers.filter(value => value !== modifier)
    if (checked) {
      const conflicts: Partial<Record<ChordModifier, ChordModifier[]>> = {
        m: ['dim', 'aug', 'sus2', 'sus4'], dim: ['m', 'aug', 'sus2', 'sus4'], aug: ['m', 'dim', 'sus2', 'sus4'],
        sus2: ['m', 'dim', 'aug', 'sus4'], sus4: ['m', 'dim', 'aug', 'sus2'],
      }
      next = next.filter(value => !conflicts[modifier]?.includes(value))
    }
    onModifiersChange([...new Set(next)])
  }

  return <div ref={editorRef} className="inline-chord-editor" role="group" aria-label="コードオプション">
    <div className="inline-editor-heading"><span>コードを編集</span><button type="button" onClick={onClose} aria-label="編集を閉じる">×</button></div>
    <label>ルート音<select value={root} onChange={event => onRootChange(event.target.value as KeyName)}>{CHORD_ROOTS.map(note => <option value={note} key={note}>{note}</option>)}</select></label>
    <label>転回形<select value={inversion} onChange={event => onInversionChange(Number(event.target.value))}>
      {toneNames.map((note, index) => <option value={index} key={`${index}-${note}`}>{`${index === 0 ? '基本形' : `第${index}転回形`} · ${note}ベース`}</option>)}
    </select></label>
    <label>分数コードのベース音<select value={slashBass ?? ''} onChange={event => onSlashBassChange(event.target.value === '' ? undefined : Number(event.target.value))}>
      <option value="">転回形に従う</option>{CHORD_ROOTS.map((note, index) => <option value={index} key={note}>{note}ベース</option>)}
    </select></label>
    <span className="modifier-label">オプションを組み合わせる</span>
    <div className="modifier-grid">{CHORD_MODIFIERS.map(option => <label className={`modifier-chip ${modifiers.includes(option.value) ? 'checked' : ''}`} key={option.value} title={option.description}><input type="checkbox" checked={modifiers.includes(option.value)} onChange={event => toggle(option.value, event.target.checked)} /><span>{option.label}</span></label>)}</div>
    <div className="inline-editor-footer"><span><small>PREVIEW · 自動反映</small><strong>{preview.symbol}</strong></span></div>
  </div>
}
