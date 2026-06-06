import { useState } from 'react'
import { getBooks } from '../lib/storage'
import { saveReaction } from '../lib/storage'
import { syncToSheets } from '../lib/claude'

const SPEEDS = ['매우 빠름', '빠름', '보통', '느림', '매우 느림']

function StarRating({ value, onChange, label }) {
  return (
    <div className="form-group">
      <label className="label">{label}</label>
      <div className="star-row">
        {[1, 2, 3, 4, 5].map(n => (
          <span
            key={n}
            className="star"
            onClick={() => onChange(n)}
            style={{ opacity: n <= value ? 1 : 0.25 }}
          >
            ⭐
          </span>
        ))}
        <span style={{ marginLeft: 8, fontSize: '0.85rem', color: '#718096' }}>{value}/5</span>
      </div>
    </div>
  )
}

export default function TabReaction() {
  const books = getBooks().filter(b => b.status !== '제외')
  const [selectedBook, setSelectedBook] = useState('')
  const [form, setForm] = useState({
    speed: '보통',
    immersion: 3,
    comprehension: 3,
    liked: '',
    disliked: '',
    wantSimilar: true,
    parentNote: '',
  })
  const [saved, setSaved] = useState(false)

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedBook) return
    const book = books.find(b => b.id === selectedBook)
    const reaction = {
      bookId: selectedBook,
      bookTitle: book?.title || '',
      ...form,
    }
    saveReaction(reaction)
    await syncToSheets('reaction', reaction)
    setSaved(true)
  }

  return (
    <div>
      <div className="card">
        <h2>📖 책 선택</h2>
        {books.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <div>먼저 탭 1에서 책을 평가하고 저장하세요</div>
          </div>
        ) : (
          <div className="form-group">
            <label className="label">읽은 책</label>
            <select
              className="select"
              value={selectedBook}
              onChange={e => { setSelectedBook(e.target.value); setSaved(false) }}
            >
              <option value="">-- 책 선택 --</option>
              {books.map(b => (
                <option key={b.id} value={b.id}>{b.title} ({b.author})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedBook && (
        <div className="card">
          <h2>💬 반응 기록</h2>

          <div className="form-group">
            <label className="label">읽은 속도</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SPEEDS.map(s => (
                <button
                  key={s}
                  className={`filter-chip ${form.speed === s ? 'active' : ''}`}
                  onClick={() => set('speed', s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <StarRating value={form.immersion} onChange={v => set('immersion', v)} label="몰입도" />
          <StarRating value={form.comprehension} onChange={v => set('comprehension', v)} label="이해도" />

          <div className="form-group">
            <label className="label">좋아한 요소</label>
            <textarea
              className="textarea"
              placeholder="어떤 부분이 재미있었나요?"
              value={form.liked}
              onChange={e => set('liked', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">싫어한 요소</label>
            <textarea
              className="textarea"
              placeholder="불편하거나 지루했던 부분"
              value={form.disliked}
              onChange={e => set('disliked', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">비슷한 책 또 원함?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[true, false].map(v => (
                <button
                  key={String(v)}
                  className={`filter-chip ${form.wantSimilar === v ? 'active' : ''}`}
                  onClick={() => set('wantSimilar', v)}
                >
                  {v ? '✅ 네, 더 원해요' : '❌ 아니요'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="label">부모 관찰 메모</label>
            <textarea
              className="textarea"
              placeholder="부모가 관찰한 내용 (행동 변화, 질문, 감정 반응 등)"
              value={form.parentNote}
              onChange={e => set('parentNote', e.target.value)}
            />
          </div>

          <button
            className="btn-primary"
            disabled={saved}
            onClick={handleSave}
          >
            {saved ? '✅ 반응 저장됨' : '💾 반응 기록 저장'}
          </button>
        </div>
      )}
    </div>
  )
}
