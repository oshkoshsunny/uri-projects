import { URI_PROFILE, URI_INTERESTS } from './config'

const API_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()

const SYSTEM_PROMPT = `You are a children's book evaluator for a Korean parent filtering books for their child "Uri" (유리).
Uri is a child who loves: cubing (very strong), taekwondo (strong), games/strategy (strong), Bible stories (observing), science (expanding).
Uri filter criteria:
- ALLOWED: general fantasy, friendship, emotional growth, natural romance at US elementary level
- CAUTION: LGBTQ-centric narrative, mocking authority, parent-bashing, precocious sexual content, cynicism
- PREFERRED: courage, sacrifice, growth, values compatible with Christian faith

IMPORTANT: All text fields (except title, author, genre, tags) must be written in Korean.
Always respond in valid JSON only, no markdown, no explanation outside JSON.`

export async function evaluateBookFromImage(base64Image, mimeType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Image },
            },
            {
              type: 'text',
              text: `Analyze this book cover image and return a JSON object with these exact fields:
{
  "title": "책 제목 (원제 그대로)",
  "author": "저자명",
  "genre": "장르 (한국어)",
  "ageAppropriate": "yes/caution/no",
  "ageReason": "연령 적합성 이유 (한국어, 1~2문장)",
  "cautionFlags": ["주의 항목 한국어 배열, 없으면 빈 배열"],
  "interestingElements": "유리가 흥미로울 요소 (한국어)",
  "valueElements": "책에 담긴 가치관 요소 (한국어)",
  "interestConnection": "유리의 관심사와의 연결점 (한국어)",
  "verdict": "제공/보류/제외",
  "verdictReason": "판정 이유 (한국어, 1~2문장)",
  "tags": ["영어태그1", "영어태그2", "영어태그3"]
}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const raw = data.content[0].text
  const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(text)
}

export async function generateDiscussionQuestions(book) {
  const interestsText = URI_INTERESTS.interests.join(', ')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: `너는 부모-자녀 독서 대화를 돕는 질문 생성기야.
${URI_PROFILE}
유리의 현재 관심사: ${interestsText}
(관심사 업데이트: ${URI_INTERESTS.lastUpdated})

규칙:
- 6개 질문, 고정 순서: 인물 → 줄거리(why) → 어휘 → 적용 → 감정·생각 → 비판적의견
- 6개 중 최소 1개 이상은 평가 결과(흥미요소/가치관요소/관심사연결)의 표현을 직접 인용하거나 변형해서 질문에 포함
- "적용"과 "비판적의견" 타입은 가치관요소·관심사연결을 우선 반영
- 질문 문장은 한국어, 짧고 단순하게. 어휘 타입만 targetVocab 필드에 영어 원문 단어 포함
- 멀티스텝 지시 지양. 비판적의견 질문의 parentGuide 끝에 "→ 답이 안 나오면 '그럼 너라면 어떻게 했을 것 같아?'로 좁혀서 다시 물어보기" 추가
- parentGuide는 절대로 대화 방법/팁이 아니라, 책의 실제 내용 요약이어야 함. 부모가 책을 안 읽었어도 이 내용만 보면 자녀와 대화할 수 있도록, 해당 질문과 관련된 책 속 실제 인물/사건/배경을 구체적으로 서술할 것. 예시: "올리브, 토비, 화이트가 주요 인물. 각자 다른 능력으로 5개 세계의 등불을 밝히는 임무를 함께 수행함"
- JSON만 응답, 마크다운 없이`,
      messages: [
        {
          role: 'user',
          content: `다음 책 평가 결과를 바탕으로 유리를 위한 독서 대화 질문 6개를 생성해줘.

책 제목: ${book.title}
저자: ${book.author}
장르: ${book.genre}
흥미 요소: ${book.interestingElements}
가치관 요소: ${book.valueElements}
관심사 연결: ${book.interestConnection}
DB 태그: ${(book.tags || []).join(', ')}

응답 형식:
{
  "questions": [
    {
      "order": 1,
      "type": "인물",
      "question": "한국어 질문",
      "parentGuide": "부모용 맥락 설명"
    },
    {
      "order": 2,
      "type": "줄거리(why)",
      "question": "한국어 질문",
      "parentGuide": "부모용 맥락 설명"
    },
    {
      "order": 3,
      "type": "어휘",
      "question": "한국어 질문",
      "parentGuide": "부모용 맥락 설명",
      "targetVocab": "영어 단어"
    },
    {
      "order": 4,
      "type": "적용",
      "question": "한국어 질문",
      "parentGuide": "부모용 맥락 설명"
    },
    {
      "order": 5,
      "type": "감정·생각",
      "question": "한국어 질문",
      "parentGuide": "부모용 맥락 설명"
    },
    {
      "order": 6,
      "type": "비판적의견",
      "question": "한국어 질문",
      "parentGuide": "부모용 맥락 설명"
    }
  ]
}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const raw = data.content[0].text
  const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(text).questions
}

export async function generateVocabCards(book) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `다음 책에서 9세 아이(그래픽노블 독자)가 배울 만한 영어 단어 3~5개를 뽑아줘.
책 제목: ${book.title} / 장르: ${book.genre}
참고: 본문 스캔 없이 책 정보만으로 추정하므로 실제 등장 보장 안 됨.

JSON만 응답:
{
  "vocab": [
    { "word": "영어단어", "meaning": "한국어 뜻", "example": "예문 (영어 단어 포함 짧은 한국어 문장)" }
  ]
}`,
        },
      ],
    }),
  })

  if (!response.ok) return []
  const data = await response.json()
  const raw = data.content[0].text
  const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(text).vocab
}

export async function syncToSheets(type, data) {
  try {
    await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    })
  } catch {
    // silent
  }
}
