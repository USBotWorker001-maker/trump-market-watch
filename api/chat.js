export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, ...body } = req.body

  // NewsAPI proxy - key stays server side
  if (type === 'news') {
    const { query, from } = body
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&from=${from}&sortBy=publishedAt&pageSize=20&apiKey=${process.env.VITE_NEWSAPI_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    return res.status(response.status).json(data)
  }

  // Anthropic proxy
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  res.status(response.status).json(data)
}