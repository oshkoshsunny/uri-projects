const API_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()

const SYSTEM_PROMPT = `You are a children's book evaluator for a Korean parent filtering books for their child "Uri" (유리).
Uri is a child who loves: cubing (very strong), taekwondo (strong), games/strategy (strong), Bible stories (observing), science (expanding).
Uri filter criteria:
- ALLOWED: general fantasy, friendship, emotional growth, natural romance at US elementary level
- CAUTION: LGBTQ-centric narrative, mocking authority, parent-bashing, precocious sexual content, cynicism
- PREFERRED: courage, sacrifice, growth, values compatible with Christian faith

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
  "title": "book title",
  "author": "author name",
  "genre": "genre",
  "ageAppropriate": "yes/caution/no",
  "ageReason": "brief reason",
  "cautionFlags": ["list of caution items or empty array"],
  "interestingElements": "what would engage Uri",
  "valueElements": "values present in the book",
  "interestConnection": "how it connects to Uri's interests",
  "verdict": "제공/보류/제외",
  "verdictReason": "brief reason for verdict",
  "tags": ["tag1", "tag2", "tag3"]
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

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw_LzlXtHF1o4YY1NFzTJACqROseVKZltUfOSr4Ih4-Cwicnjk4fJbCyPQTdNJ7LLKR2A/exec'

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
