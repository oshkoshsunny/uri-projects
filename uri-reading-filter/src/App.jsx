import { useState, useRef, useEffect } from "react";

const FILTER = `
Uri Book Filter (9세 아동):

허용: 일반 판타지, 우정, 감정 성장, 미국 초등학생 수준의 자연스러운 로맨스
주의: LGBTQ 중심 서사, 권위 조롱, 부모 혐오, 조숙한 성적 표현, 냉소주의
선호: 용기, 희생, 성장, 신앙적 가치와 큰 충돌 없음

판정 기준:
- PASS+: 강력 추천, 선호 요소 다수 포함
- PASS: 문제 없음, 취향 일치 여부는 불확실
- 주의: 주의 요소 포함, 부모 검토 필요
- 제외: 필터 기준 미통과

응답은 반드시 JSON만, 마크다운 없이:
{
  "title": "책 제목 (영어)",
  "verdict": "PASS+ 또는 PASS 또는 주의 또는 제외",
  "stars": 1~5 숫자,
  "reason": "판정 이유 한두 문장",
  "tags": ["관련 태그 2~3개"],
  "uri_fit": "Uri 취향과의 적합성 한 문장"
}
`;

const VERDICT_CONFIG = {
  "PASS+": { color: "#00C896", bg: "#00C89615", label: "PASS+" },
  "PASS": { color: "#4A9EFF", bg: "#4A9EFF15", label: "PASS" },
  "주의": { color: "#FFB800", bg: "#FFB80015", label: "주의" },
  "제외": { color: "#FF4757", bg: "#FF475715", label: "제외" },
};

const CHOICE_OPTIONS = ["빌림", "구매", "패스"];
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwGQ1oHbcbXj2gtBQIEtSwzDUpmfp13tCoai6xBJMeHke8RmsuFfzjnIq0vUVDCZlxXeQ/exec";

export default function App() {
  const [books, setBooks] = useState([]);
  const [view, setView] = useState("scanner");
  const [scanning, setScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [uriChoice, setUriChoice] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sheetsSaved, setSheetsSaved] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("uri-books");
        if (saved) setBooks(JSON.parse(saved.value));
      } catch {}
    })();
  }, []);

  const saveBooks = async (updated) => {
    try {
      await window.storage.set("uri-books", JSON.stringify(updated));
    } catch {}
    setBooks(updated);
  };

  const analyzeImage = async (base64) => {
    setScanning(true);
    setCurrentResult(null);
    setUriChoice(null);
    setSheetsSaved(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 1000,
          system: FILTER,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
              { type: "text", text: "이 책 표지를 보고 Uri 필터 기준으로 판정해줘. JSON만 응답해." }
            ]
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setCurrentResult({ ...parsed, image: base64, date: new Date().toLocaleDateString("ko-KR") });
    } catch (e) {
      setCurrentResult({ error: true });
    }
    setScanning(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      URL.revokeObjectURL(url);
      analyzeImage(base64);
    };
    img.src = url;
  };

  const saveBook = async () => {
    if (!currentResult || currentResult.error) return;
    const entry = { ...currentResult, uriChoice: uriChoice || "미선택", id: Date.now() };
    const updated = [entry, ...books];
    await saveBooks(updated);

    // Google Sheets에 저장
    try {
      await fetch(SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entry.date,
          title: entry.title,
          verdict: entry.verdict,
          stars: entry.stars,
          reason: entry.reason,
          uri_fit: entry.uri_fit,
          tags: entry.tags?.join(", ") || "",
          uriChoice: entry.uriChoice,
          imageLink: ""
        })
      });
      setSheetsSaved(true);
    } catch (e) {
      setSheetsSaved(false);
    }

    setCurrentResult(null);
    setUriChoice(null);
  };

  const deleteBook = async (id) => {
    const updated = books.filter(b => b.id !== id);
    await saveBooks(updated);
  };

  const cfg = currentResult && !currentResult.error ? VERDICT_CONFIG[currentResult.verdict] || VERDICT_CONFIG["PASS"] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0F",
      color: "#E8E8F0",
      fontFamily: "'Georgia', serif",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 24px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#666", marginBottom: 4, fontFamily: "monospace" }}>URI READING</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Book Filter</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {["scanner", "library"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "monospace",
              letterSpacing: 1,
              background: view === v ? "#E8E8F0" : "#1A1A24",
              color: view === v ? "#0A0A0F" : "#666",
              transition: "all 0.2s",
            }}>
              {v === "scanner" ? "스캔" : `라이브러리 ${books.length}`}
            </button>
          ))}
        </div>
      </div>

      {/* Sheets 저장 알림 */}
      {sheetsSaved !== null && (
        <div style={{
          margin: "12px 24px 0",
          padding: "10px 14px",
          borderRadius: 10,
          background: sheetsSaved ? "#00C89615" : "#FF475715",
          border: `1px solid ${sheetsSaved ? "#00C89640" : "#FF475740"}`,
          color: sheetsSaved ? "#00C896" : "#FF4757",
          fontSize: 13,
          fontFamily: "monospace",
        }}>
          {sheetsSaved ? "✓ Google Sheets에 저장됐어요" : "⚠ Sheets 저장 실패 (앱에는 저장됨)"}
        </div>
      )}

      {view === "scanner" && (
        <div style={{ padding: 24 }}>
          {!currentResult && !scanning && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragOver ? "#00C896" : "#2A2A3A"}`,
                borderRadius: 16,
                padding: "48px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "#00C89608" : "#10101A",
                transition: "all 0.2s",
                marginBottom: 24,
              }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📷</div>
              <div style={{ fontSize: 16, color: "#888", marginBottom: 8 }}>책 표지 사진을 올려주세요</div>
              <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace" }}>탭하거나 드래그</div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={e => handleFile(e.target.files[0])} style={{ display: "none" }} />
            </div>
          )}

          {scanning && (
            <div style={{
              background: "#10101A",
              borderRadius: 16,
              padding: 48,
              textAlign: "center",
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 32, marginBottom: 16, animation: "spin 1s linear infinite" }}>⟳</div>
              <div style={{ color: "#666", fontFamily: "monospace", fontSize: 13, letterSpacing: 2 }}>ANALYZING...</div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {currentResult && !currentResult.error && cfg && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ background: "#10101A", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
                {currentResult.image && (
                  <img src={`data:image/jpeg;base64,${currentResult.image}`}
                    style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} alt="book" />
                )}
                <div style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, flex: 1, marginRight: 12 }}>{currentResult.title}</div>
                    <div style={{
                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`,
                      borderRadius: 8, padding: "4px 12px", fontSize: 13, fontWeight: 700,
                      fontFamily: "monospace", whiteSpace: "nowrap",
                    }}>{cfg.label}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    {[1,2,3,4,5].map(s => (
                      <span key={s} style={{ fontSize: 18, color: s <= currentResult.stars ? "#FFB800" : "#2A2A3A" }}>★</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 14, color: "#AAA", marginBottom: 12, lineHeight: 1.6 }}>{currentResult.reason}</div>
                  <div style={{ background: "#1A1A2A", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#888", marginBottom: 12, fontStyle: "italic" }}>
                    💭 {currentResult.uri_fit}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {currentResult.tags?.map(tag => (
                      <span key={tag} style={{
                        background: "#1A1A2A", border: "1px solid #2A2A3A", borderRadius: 20,
                        padding: "3px 10px", fontSize: 11, color: "#666", fontFamily: "monospace",
                      }}>#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: "#10101A", borderRadius: 16, padding: 20, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 12, fontFamily: "monospace", letterSpacing: 1 }}>URI의 선택</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {CHOICE_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setUriChoice(opt)} style={{
                      flex: 1, padding: "10px 0", borderRadius: 10,
                      border: `1px solid ${uriChoice === opt ? "#00C896" : "#2A2A3A"}`,
                      background: uriChoice === opt ? "#00C89615" : "transparent",
                      color: uriChoice === opt ? "#00C896" : "#555",
                      cursor: "pointer", fontSize: 14, transition: "all 0.2s",
                    }}>{opt}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveBook} style={{
                  flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
                  background: "#00C896", color: "#0A0A0F", fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>저장하기</button>
                <button onClick={() => { setCurrentResult(null); setUriChoice(null); }} style={{
                  padding: "14px 20px", borderRadius: 12, border: "1px solid #2A2A3A",
                  background: "transparent", color: "#555", fontSize: 15, cursor: "pointer",
                }}>다시</button>
              </div>
            </div>
          )}

          {currentResult?.error && (
            <div style={{ background: "#FF475715", border: "1px solid #FF475740", borderRadius: 16, padding: 24, textAlign: "center" }}>
              <div style={{ color: "#FF4757", marginBottom: 8 }}>판정 실패</div>
              <button onClick={() => setCurrentResult(null)} style={{
                background: "transparent", border: "1px solid #FF4757", color: "#FF4757",
                padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13
              }}>다시 시도</button>
            </div>
          )}
        </div>
      )}

      {view === "library" && (
        <div style={{ padding: 24 }}>
          {books.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#444" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
              <div style={{ fontFamily: "monospace", fontSize: 13 }}>아직 저장된 책이 없어요</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {books.map(book => {
                const c = VERDICT_CONFIG[book.verdict] || VERDICT_CONFIG["PASS"];
                return (
                  <div key={book.id} style={{ background: "#10101A", borderRadius: 14, overflow: "hidden", display: "flex" }}>
                    {book.image && (
                      <img src={`data:image/jpeg;base64,${book.image}`}
                        style={{ width: 72, objectFit: "cover", flexShrink: 0 }} alt="book" />
                    )}
                    <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {book.title}
                        </div>
                        <div style={{
                          background: c.bg, color: c.color, border: `1px solid ${c.color}40`,
                          borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                          fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0,
                        }}>{c.label}</div>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ fontSize: 12, color: s <= book.stars ? "#FFB800" : "#2A2A3A" }}>★</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 6, lineHeight: 1.5 }}>{book.reason}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{
                            fontSize: 11,
                            background: book.uriChoice === "빌림" ? "#4A9EFF20" : book.uriChoice === "구매" ? "#00C89620" : "#1A1A2A",
                            color: book.uriChoice === "빌림" ? "#4A9EFF" : book.uriChoice === "구매" ? "#00C896" : "#555",
                            border: `1px solid ${book.uriChoice === "빌림" ? "#4A9EFF40" : book.uriChoice === "구매" ? "#00C89640" : "#2A2A3A"}`,
                            borderRadius: 20, padding: "2px 8px", fontFamily: "monospace",
                          }}>Uri: {book.uriChoice}</span>
                          <span style={{ fontSize: 11, color: "#333", fontFamily: "monospace" }}>{book.date}</span>
                        </div>
                        <button onClick={() => deleteBook(book.id)} style={{
                          background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 16, padding: "4px 8px",
                        }}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
