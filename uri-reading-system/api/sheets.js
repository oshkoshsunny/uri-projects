import { google } from 'googleapis'

const SHEET_ID = '1U0ILpcwqvMODxjwpiyTdKzlfoxIcURpYAQ2l_wSyOW0'

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

async function ensureHeader(sheets, sheetName, headers) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z1`,
  })
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    })
  }
}

async function getSheetIdByName(sheets, name) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const sheet = meta.data.sheets.find(s => s.properties.title === name)
  return sheet ? sheet.properties.sheetId : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const sheets = await getSheets()
    const { type, data } = req.body

    if (type === 'book') {
      const sheetName = 'Books'
      await ensureHeader(sheets, sheetName, ['날짜','ID','제목','저자','장르','판정','점수','연령적합','태그','흥미요소','가치관','관심사연결','상태'])
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            new Date().toLocaleString('ko-KR'), data.id, data.title, data.author, data.genre,
            data.verdict, data.score, data.ageAppropriate,
            (data.tags || []).join(', '),
            data.interestingElements, data.valueElements,
            data.interestConnection, data.status || '후보'
          ]]
        },
      })
    }

    if (type === 'deleteBook') {
      const sheetName = 'Books'
      const rows = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A:M`,
      })
      const values = rows.data.values || []
      const sheetId = await getSheetIdByName(sheets, sheetName)
      const deleteRequests = []
      for (let i = values.length - 1; i >= 1; i--) {
        const rowId = String(values[i][1] || '')
        const rowTitle = String(values[i][2] || '')
        if ((data.id && rowId === String(data.id)) || (data.title && rowTitle === data.title)) {
          deleteRequests.push({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } })
        }
      }
      if (deleteRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: deleteRequests } })
      }
    }

    if (type === 'updateStatus') {
      const sheetName = 'Books'
      const rows = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A:M`,
      })
      const values = rows.data.values || []
      for (let i = 1; i < values.length; i++) {
        const rowId = String(values[i][1] || '')
        const rowTitle = String(values[i][2] || '')
        if ((data.id && rowId === String(data.id)) || (data.title && rowTitle === data.title)) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${sheetName}!M${i + 1}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[data.status]] },
          })
        }
      }
    }

    if (type === 'reaction') {
      const sheetName = 'Reactions'
      await ensureHeader(sheets, sheetName, ['날짜','책제목','읽은속도','몰입도','이해도','좋아한요소','싫어한요소','비슷한책원함','부모메모'])
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            new Date().toLocaleString('ko-KR'), data.bookTitle, data.speed,
            data.immersion, data.comprehension,
            data.liked, data.disliked,
            data.wantSimilar ? '예' : '아니요',
            data.parentNote
          ]]
        },
      })
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
