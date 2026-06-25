const BOOKS_KEY = 'uri_books_db'
const REACTIONS_KEY = 'uri_reactions_db'

export function getBooks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveBook(book) {
  const books = getBooks()
  const existing = books.findIndex(b => b.id === book.id)
  if (existing >= 0) {
    books[existing] = book
  } else {
    books.unshift({ ...book, id: book.id || Date.now().toString(), createdAt: Date.now() })
  }
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books))
  return books
}

export function updateBookStatus(id, status) {
  const books = getBooks()
  const idx = books.findIndex(b => b.id === id)
  if (idx >= 0) {
    books[idx].status = status
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books))
  }
  return books
}

export function getReactions() {
  try {
    return JSON.parse(localStorage.getItem(REACTIONS_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveReaction(reaction) {
  const reactions = getReactions()
  reactions.unshift({ ...reaction, id: Date.now().toString(), createdAt: Date.now() })
  localStorage.setItem(REACTIONS_KEY, JSON.stringify(reactions))
  return reactions
}

export function updateBookQuestions(id, questions) {
  const books = getBooks()
  const idx = books.findIndex(b => b.id === id)
  if (idx >= 0) {
    books[idx].questions = questions
    books[idx].questionsGeneratedAt = Date.now()
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books))
  }
  return books
}

export function updateBookVocab(id, vocab) {
  const books = getBooks()
  const idx = books.findIndex(b => b.id === id)
  if (idx >= 0) {
    books[idx].vocab = vocab
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books))
  }
  return books
}

export function calcScore(eval_data) {
  if (eval_data.verdict === '제외') return -99
  let score = 0
  const tags = (eval_data.tags || []).join(' ').toLowerCase()
  const interests = (eval_data.interestConnection || '').toLowerCase()
  const values = (eval_data.valueElements || '').toLowerCase()

  if (/액션|모험|문제.?해결|adventure|action|puzzle|quest/.test(tags + interests)) score += 2
  if (/큐브|태권도|게임|수학|퍼즐|전략|스포츠/.test(interests)) score += 2
  if (/우정|책임|성장|friendship|responsibility|growth/.test(values + tags)) score += 1
  if (/과학|역사|발명|탐험|새로운.?분야/.test(interests + tags)) score += 1
  if (/관계.?중심|romance|로맨스/.test(tags)) score -= 2

  return score
}
