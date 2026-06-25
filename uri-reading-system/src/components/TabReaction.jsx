import { useState } from 'react'
import { getReactions } from '../lib/storage'

export default function TabReaction() {
  const [reactions] = useState(getReactions)

  if (reactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">💬</div>
        <div>아직 기록된 반응이 없어요.</div>
        <div style={{ fontSize: '0.82rem', color: '#aaa', marginTop: 6 }}>라이브러리에서 책 카드를 열고 "유리 반응 추가"를 눌러주세요.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="card" style={{ paddingBottom: 8 }}>
        <h2>💬 유리 반응 기록 ({reactions.length}건)</h2>
      </div>
      {reactions.map((r, i) => (
        <div key={i} className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{r.bookTitle}</div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: 10 }}>{new Date(r.createdAt).toLocaleString('ko-KR')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="badge badge-gray">속도: {r.speed}</span>
            <span className="badge badge-blue">몰입 {'⭐'.repeat(r.immersion)}</span>
            <span className="badge badge-green">이해 {'⭐'.repeat(r.comprehension)}</span>
            <span className={`badge ${r.wantSimilar ? 'badge-green' : 'badge-red'}`}>{r.wantSimilar ? '비슷한 책 원함' : '비슷한 책 필요없음'}</span>
          </div>
          {r.liked && (
            <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
              <span style={{ color: '#718096' }}>좋아한 요소: </span>{r.liked}
            </div>
          )}
          {r.disliked && (
            <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
              <span style={{ color: '#718096' }}>싫어한 요소: </span>{r.disliked}
            </div>
          )}
          {r.parentNote && (
            <div style={{ fontSize: '0.85rem', padding: '8px 10px', background: '#f8f9fa', borderRadius: 6, color: '#555' }}>
              👨‍👩‍👧 {r.parentNote}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
