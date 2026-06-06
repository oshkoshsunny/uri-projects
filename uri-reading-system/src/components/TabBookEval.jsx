import { useState, useRef } from 'react'
import { evaluateBookFromImage, syncToSheets } from '../lib/claude'
import { saveBook, calcScore } from '../lib/storage'

export default function TabBookEval() {
  const [imagePreview, setImagePreview] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setImagePreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImageData({ base64, mimeType: file.type })
      setResult(null)
      setSaved(false)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  async function handleEvaluate() {
    if (!imageData) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const eval_result = await evaluateBookFromImage(imageData.base64, imageData.mimeType)
      setResult(eval_result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!result) return
    const book = {
      id: Date.now().toString(),
      ...result,
      score: calcScore(result),
      status: '후보',
      imagePreview,
    }
    saveBook(book)
    await syncToSheets('book', book)
    setSaved(true)
  }

  const verdictClass = {
    '제공': 'verdict-provide',
    '보류': 'verdict-hold',
    '제외': 'verdict-exclude',
  }

  const verdictLabel = {
    '제공': '✅ 제공 — 읽혀도 좋습니다',
    '보류': '⚠️ 보류 — 검토 후 결정',
    '제외': '❌ 제외 — 권장하지 않음',
  }

  return (
    <div>
      <div className="card">
        <h2>📸 책 표지 촬영 / 업로드</h2>

        <div
          className="upload-area"
          onClick={() => fileInputRef.current.click()}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Book cover" />
          ) : (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🖼️</div>
              <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                탭해서 사진 선택
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => cameraInputRef.current.click()}
          >
            📷 카메라 촬영
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => fileInputRef.current.click()}
          >
            🗂️ 사진 선택
          </button>
        </div>

        <button
          className="btn-primary"
          style={{ marginTop: 12 }}
          disabled={!imageData || loading}
          onClick={handleEvaluate}
        >
          {loading ? <><span className="spinner" />분석 중...</> : '🔍 Claude로 책 평가하기'}
        </button>

        {error && (
          <div style={{ marginTop: 10, padding: 10, background: '#fed7d7', borderRadius: 8, fontSize: '0.85rem', color: '#742a2a' }}>
            오류: {error}
          </div>
        )}
      </div>

      {result && (
        <div className="card">
          <h2>📋 평가 결과</h2>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{result.title}</div>
            <div style={{ color: '#718096', fontSize: '0.85rem' }}>{result.author} · {result.genre}</div>
          </div>

          <div className="result-section">
            <div className="result-row">
              <span className="result-key">연령 적합성</span>
              <span className="result-val">
                <span className={`badge ${result.ageAppropriate === 'yes' ? 'badge-green' : result.ageAppropriate === 'caution' ? 'badge-yellow' : 'badge-red'}`}>
                  {result.ageAppropriate === 'yes' ? '✅ 적합' : result.ageAppropriate === 'caution' ? '⚠️ 주의' : '❌ 부적합'}
                </span>
                {result.ageReason && <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: 2 }}>{result.ageReason}</div>}
              </span>
            </div>

            {result.cautionFlags?.length > 0 && (
              <div className="result-row">
                <span className="result-key">주의 항목</span>
                <span className="result-val">
                  {result.cautionFlags.map((f, i) => (
                    <span key={i} className="badge badge-yellow" style={{ marginLeft: 2 }}>{f}</span>
                  ))}
                </span>
              </div>
            )}

            <div className="result-row">
              <span className="result-key">흥미 요소</span>
              <span className="result-val">{result.interestingElements}</span>
            </div>

            <div className="result-row">
              <span className="result-key">가치관 요소</span>
              <span className="result-val">{result.valueElements}</span>
            </div>

            <div className="result-row">
              <span className="result-key">관심사 연결</span>
              <span className="result-val">{result.interestConnection}</span>
            </div>

            <div className="result-row">
              <span className="result-key">DB 태그</span>
              <span className="result-val">
                {result.tags?.map((t, i) => (
                  <span key={i} className="badge badge-blue" style={{ marginLeft: 2 }}>{t}</span>
                ))}
              </span>
            </div>
          </div>

          <div className={`verdict-box ${verdictClass[result.verdict] || 'verdict-hold'}`}>
            {verdictLabel[result.verdict] || result.verdict}
            {result.verdictReason && (
              <div style={{ fontSize: '0.8rem', fontWeight: 400, marginTop: 4 }}>{result.verdictReason}</div>
            )}
          </div>

          <button
            className="btn-primary"
            style={{ marginTop: 12 }}
            disabled={saved}
            onClick={handleSave}
          >
            {saved ? '✅ DB에 저장됨' : '💾 책 후보 DB에 저장'}
          </button>
        </div>
      )}
    </div>
  )
}
