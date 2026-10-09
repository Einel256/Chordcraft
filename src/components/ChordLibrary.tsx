import { FUNCTION_DESCRIPTIONS, getDiatonicChords, type KeyName } from '../music/progression'

export default function ChordLibrary({ keyName, selectedIndex, onApply, onInsert, onPreview }: {
  keyName: KeyName
  selectedIndex: number
  onApply: (chordIndex: number) => void
  onInsert: (chordIndex: number) => void
  onPreview: (chordIndex: number) => void
}) {
  const chords = getDiatonicChords(keyName)

  return <section className="library panel" aria-labelledby="library-title">
    <div className="library-heading">
      <div className="panel-heading"><span className="section-index">03</span><div><h2 id="library-title">ディグリーネーム / コード表</h2><p>{keyName} major の度数・コード・音楽的な役割</p></div></div>
      <div className="library-instruction"><span className="library-key">{String(selectedIndex + 1).padStart(2, '0')}</span>小節目を選択中 · 度数カードで置換 / ＋で追加</div>
    </div>
    <div className="diatonic-grid">
      {chords.map((chord, index) => <div className="diatonic-card-wrap" key={chord.roman}>
        <button type="button" className="diatonic-card" onClick={() => onApply(index)} aria-label={`${chord.symbol}を${selectedIndex + 1}小節目に適用`}>
          <span className="diatonic-top"><span className="diatonic-degree">{chord.roman}</span><i className={`role-dot role-${chord.role.toLowerCase()}`} /></span>
          <strong>{chord.symbol}</strong>
          <span className={`diatonic-function role-text-${chord.role.toLowerCase()}`}>{FUNCTION_DESCRIPTIONS[index].split('｜')[0]}</span>
          <span className="diatonic-description">{FUNCTION_DESCRIPTIONS[index].split('｜')[1]}</span>
        </button>
        <button type="button" className="diatonic-preview" onClick={() => onPreview(index)} aria-label={`${chord.symbol}を試聴`} title={`${chord.symbol}を試聴`}>▶</button>
        <button type="button" className="diatonic-insert" onClick={() => onInsert(index)} aria-label={`${chord.symbol}を${selectedIndex + 1}小節目の次に追加`} title="選択中の小節の次に追加">＋</button>
      </div>)}
    </div>
    <div className="library-legend"><span><i className="legend-dot tonic" />トニック機能</span><span><i className="legend-dot predominant" />サブドミナント機能</span><span><i className="legend-dot dominant" />ドミナント機能</span></div>
  </section>
}
