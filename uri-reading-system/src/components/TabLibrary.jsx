import { useState } from 'react'
import { getBooks, updateBookStatus, updateBookQuestions, updateBookVocab, calcScore, saveReaction, getReactions } from '../lib/storage'
import { syncToSheets, generateDiscussionQuestions, generateVocabCards } from '../lib/claude'

const SPEEDS = ['매우 빠름', '빠름', '보통', '느림', '매우 느림']

function ReactionForm({ book, onSaved }) {
  const [form, setForm] = useState({ speed: '보통', immersion: 3, comprehension: 3, liked: '', disliked: '', wantSimilar: true, parentNote: '' })
  const [saved, setSaved] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    const reaction = { bookId: book.id, bookTitle: book.title, ...form }
    saveReaction(reaction)
    await syncToSheets('reaction', reaction)
    setSaved(true)
    onSaved?.()
  }

  if (saved) return (
    <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: 8, color: '#166534', fontSize: '0.85rem', textAlign: 'center' }}>
      ✅ 반응 저장됨
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="label">읽은 속도</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {SPEEDS.map(s => (
            <button key={s} className={`filter-chip ${form.speed === s ? 'active' : ''}`} onClick={() => set('speed', s)}>{s}</button>
          ))}
        </div>
      </div>
      {[['immersion', '몰입도'], ['comprehension', '이해도']].map(([key, label]) => (
        <div key={key}>
          <div className="label">{label}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} onClick={() => set(key, n)} style={{ cursor: 'pointer', fontSize: '1.3rem', opacity: n <= form[key] ? 1 : 0.25 }}>⭐</span>
            ))}
            <span style={{ marginLeft: 6, fontSize: '0.8rem', color: '#718096' }}>{form[key]}/5</span>
          </div>
        </div>
      ))}
      <div>
        <div className="label">좋아한 요소</div>
        <textarea className="textarea" style={{ marginTop: 4 }} placeholder="어떤 부분이 재미있었나요?" value={form.liked} onChange={e => set('liked', e.target.value)} />
      </div>
      <div>
        <div className="label">싫어한 요소</div>
        <textarea className="textarea" style={{ marginTop: 4 }} placeholder="불편하거나 지루했던 부분" value={form.disliked} onChange={e => set('disliked', e.target.value)} />
      </div>
      <div>
        <div className="label">비슷한 책 또 원함?</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {[[true, '✅ 네'], [false, '❌ 아니요']].map(([v, label]) => (
            <button key={String(v)} className={`filter-chip ${form.wantSimilar === v ? 'active' : ''}`} onClick={() => set('wantSimilar', v)}>{label}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="label">부모 관찰 메모</div>
        <textarea className="textarea" style={{ marginTop: 4 }} placeholder="행동 변화, 질문, 감정 반응 등" value={form.parentNote} onChange={e => set('parentNote', e.target.value)} />
      </div>
      <button className="btn-primary" onClick={handleSave}>💾 반응 저장</button>
    </div>
  )
}

function deleteBook(id) {
  const books = JSON.parse(localStorage.getItem('uri_books_db') || '[]')
  localStorage.setItem('uri_books_db', JSON.stringify(books.filter(b => b.id !== id)))
}

const STATUSES = ['전체', '후보', '선택됨', '읽음', '중단']

const STATUS_BADGE = {
  '후보': 'badge-gray',
  '선택됨': 'badge-blue',
  '읽음': 'badge-green',
  '중단': 'badge-red',
}

function scoreClass(score) {
  if (score >= 4) return 'score-high'
  if (score >= 1) return 'score-mid'
  return 'score-low'
}

const QUESTION_TYPE_COLORS = {
  '인물': '#4A9EFF',
  '줄거리(why)': '#9B59B6',
  '어휘': '#E67E22',
  '적용': '#00C896',
  '감정·생각': '#E91E63',
  '비판적의견': '#FF4757',
}

export default function TabLibrary() {
  const [filter, setFilter] = useState('전체')
  const [books, setBooks] = useState(getBooks)
  const [expanded, setExpanded] = useState(null)
  const [generatingQuestions, setGeneratingQuestions] = useState(null)
  const [expandedQuestion, setExpandedQuestion] = useState(null)
  const [showReactionForm, setShowReactionForm] = useState(null)

  function refresh() { setBooks(getBooks()) }

  async function changeStatus(id, status) {
    updateBookStatus(id, status)
    syncToSheets('updateStatus', { id, status })
    refresh()

    if (status === '선택됨') {
      const currentBooks = getBooks()
      const book = currentBooks.find(b => b.id === id)
      if (book && !book.questions) {
        setGeneratingQuestions(id)
        try {
          const [questions, vocab] = await Promise.all([
            generateDiscussionQuestions(book),
            generateVocabCards(book),
          ])
          updateBookQuestions(id, questions)
          updateBookVocab(id, vocab)
        } catch (e) {
          console.error('질문 생성 실패:', e)
        } finally {
          setGeneratingQuestions(null)
          refresh()
        }
      }
    }
  }

  function handleDelete(id) {
    if (!window.confirm('이 책을 삭제할까요?')) return
    deleteBook(id)
    syncToSheets('deleteBook', { id })
    setExpanded(null)
    refresh()
  }

  const filtered = books
    .map(b => ({ ...b, score: calcScore(b) }))
    .filter(b => filter === '전체' || b.status === filter)
    .sort((a, b) => b.score - a.score)

  return (
    <div>
      <div className="card" style={{ paddingBottom: 8 }}>
        <h2>🗂️ 책 후보 DB ({books.length}권)</h2>
        <div className="filter-row">
          {STATUSES.map(s => (
            <button
              key={s}
              className={`filter-chip ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <div>{filter === '전체' ? '저장된 책이 없습니다.' : `"${filter}" 상태의 책이 없습니다.`}</div>
        </div>
      ) : (
        filtered.map(book => (
          <div key={book.id}>
            <div
              className="book-card"
              onClick={() => setExpanded(expanded === book.id ? null : book.id)}
              style={{ alignItems: 'stretch', padding: 0, overflow: 'hidden' }}
            >
              {/* 썸네일 영역 */}
              <div style={{ width: 64, flexShrink: 0, position: 'relative', background: '#1e1e2e' }}>
                {book.coverImage ? (
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📚</div>
                )}
                {/* 점수 배지 - 우상단 오버레이 */}
                <div
                  className={`score-circle ${scoreClass(book.score)}`}
                  style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, fontSize: '0.65rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                >
                  {book.score > 0 ? `+${book.score}` : book.score}
                </div>
              </div>

              <div className="book-info" style={{ padding: '12px 12px', flex: 1, minWidth: 0 }}>
                <div className="book-title">{book.title}</div>
                <div className="book-author">{book.author} · {book.genre}</div>
                <div className="book-tags">
                  <span className={`badge ${STATUS_BADGE[book.status] || 'badge-gray'}`}>
                    {book.status}
                  </span>
                  <span className={`badge ${book.verdict === '제공' ? 'badge-green' : book.verdict === '보류' ? 'badge-yellow' : 'badge-red'}`}>
                    {book.verdict}
                  </span>
                  {book.questions && <span className="badge badge-blue">💬 질문 있음</span>}
                  {generatingQuestions === book.id && <span className="badge badge-gray">⟳ 생성 중...</span>}
                  {book.tags?.slice(0, 2).map((t, i) => (
                    <span key={i} className="badge badge-purple">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {expanded === book.id && (
              <div className="card" style={{ marginTop: -8, marginBottom: 16, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                {/* 평가 결과 */}
                <div className="result-row">
                  <span className="result-key">흥미 요소</span>
                  <span className="result-val">{book.interestingElements}</span>
                </div>
                <div className="result-row">
                  <span className="result-key">가치관</span>
                  <span className="result-val">{book.valueElements}</span>
                </div>
                <div className="result-row">
                  <span className="result-key">관심사 연결</span>
                  <span className="result-val">{book.interestConnection}</span>
                </div>
                {book.cautionFlags?.length > 0 && (
                  <div className="result-row">
                    <span className="result-key">주의 항목</span>
                    <span className="result-val">
                      {book.cautionFlags.map((f, i) => (
                        <span key={i} className="badge badge-yellow" style={{ marginLeft: 2 }}>{f}</span>
                      ))}
                    </span>
                  </div>
                )}

                {/* 질문 섹션 */}
                {(book.questions || generatingQuestions === book.id) && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ fontSize: '0.9rem' }}>💬 유리와 대화해보세요</strong>
                      <span style={{ fontSize: '0.75rem', color: '#718096', marginLeft: 8 }}>({book.questions?.length || 0}문항)</span>
                    </div>

                    {generatingQuestions === book.id ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#718096', fontSize: '0.85rem' }}>
                        <span className="spinner" /> 질문 생성 중...
                      </div>
                    ) : (
                      book.questions?.map((q) => (
                        <div
                          key={q.order}
                          style={{
                            marginBottom: 8,
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              padding: '10px 12px',
                              cursor: 'pointer',
                              gap: 10,
                            }}
                            onClick={() => setExpandedQuestion(expandedQuestion === `${book.id}-${q.order}` ? null : `${book.id}-${q.order}`)}
                          >
                            <span style={{
                              flexShrink: 0,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 12,
                              background: `${QUESTION_TYPE_COLORS[q.type]}22`,
                              color: QUESTION_TYPE_COLORS[q.type] || '#666',
                              whiteSpace: 'nowrap',
                              marginTop: 1,
                            }}>
                              {q.type}
                            </span>
                            <span style={{ fontSize: '0.9rem', flex: 1, lineHeight: 1.4 }}>{q.question}</span>
                            <span style={{ color: '#aaa', fontSize: '0.8rem', flexShrink: 0 }}>
                              {expandedQuestion === `${book.id}-${q.order}` ? '▲' : '▼'}
                            </span>
                          </div>
                          {expandedQuestion === `${book.id}-${q.order}` && (
                            <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f0f0f0' }}>
                              {q.targetVocab && (
                                <div style={{ marginTop: 8, padding: '6px 10px', background: '#fff8e1', borderRadius: 6, fontSize: '0.82rem', color: '#7b5e00' }}>
                                  확인 단어: <strong>{q.targetVocab}</strong>
                                </div>
                              )}
                              <div style={{ marginTop: 8, padding: '8px 10px', background: '#f8f9fa', borderRadius: 6, fontSize: '0.82rem', color: '#555' }}>
                                👨‍👩‍👧 {q.parentGuide}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 어휘 카드 섹션 */}
                {book.vocab?.length > 0 && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ fontSize: '0.9rem' }}>📝 영어 어휘 카드</strong>
                      <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 8 }}>추정 단어 (본문 미확인)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {book.vocab.map((v, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: '#f0faf7', borderRadius: 8, fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: '#2d6a4f' }}>{v.word}</div>
                          <div style={{ color: '#555', marginTop: 2 }}>{v.meaning}</div>
                          <div style={{ color: '#888', fontSize: '0.78rem', marginTop: 3, fontStyle: 'italic' }}>{v.example}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 유리 반응 */}
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
                {showReactionForm === book.id ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <strong style={{ fontSize: '0.9rem' }}>💬 유리 반응 기록</strong>
                      <button onClick={() => setShowReactionForm(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                    </div>
                    <ReactionForm book={book} onSaved={() => setShowReactionForm(null)} />
                  </>
                ) : (
                  <button
                    onClick={() => setShowReactionForm(book.id)}
                    style={{ width: '100%', padding: '10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    💬 유리 반응 추가
                  </button>
                )}

                {/* 상태 변경 */}
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
                <div style={{ marginTop: 0 }}>
                  <label className="label">상태 변경</label>
                  <div className="filter-row" style={{ marginBottom: 0 }}>
                    {['후보', '선택됨', '읽음', '중단'].map(s => (
                      <button
                        key={s}
                        className={`filter-chip ${book.status === s ? 'active' : ''}`}
                        onClick={() => changeStatus(book.id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(book.id)}
                  style={{ marginTop: 12, width: '100%', padding: '8px', background: '#fed7d7', color: '#742a2a', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  🗑️ 삭제
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
