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
  const text = data.content[0].text
  return JSON.parse(text)
}

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyHflc5L394cxcZzj8ubjnitPqeqPC0oXpm7jEsB-79Rn_EpIB5UxkOtLnXa0IBdXkpOQ/exec'

export async function syncToSheets(type, data) {
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ type, data }),
    })
  } catch {
    // silent
  }
}
