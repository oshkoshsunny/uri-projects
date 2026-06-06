import { useState } from 'react'
import { getBooks, updateBookStatus, calcScore } from '../lib/storage'
import { syncToSheets } from '../lib/claude'

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

export default function TabLibrary() {
  const [filter, setFilter] = useState('전체')
  const [books, setBooks] = useState(getBooks)
  const [expanded, setExpanded] = useState(null)

  function refresh() { setBooks(getBooks()) }

  function changeStatus(id, status) {
    updateBookStatus(id, status)
    syncToSheets('updateStatus', { id, status })
    refresh()
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
            >
              <div
                className={`score-circle ${scoreClass(book.score)}`}
              >
                {book.score > 0 ? `+${book.score}` : book.score}
              </div>
              <div className="book-info">
                <div className="book-title">{book.title}</div>
                <div className="book-author">{book.author} · {book.genre}</div>
                <div className="book-tags">
                  <span className={`badge ${STATUS_BADGE[book.status] || 'badge-gray'}`}>
                    {book.status}
                  </span>
                  <span className={`badge ${book.verdict === '제공' ? 'badge-green' : book.verdict === '보류' ? 'badge-yellow' : 'badge-red'}`}>
                    {book.verdict}
                  </span>
                  {book.tags?.slice(0, 2).map((t, i) => (
                    <span key={i} className="badge badge-purple">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {expanded === book.id && (
              <div className="card" style={{ marginTop: -8, marginBottom: 16, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
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
                <div style={{ marginTop: 12 }}>
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
