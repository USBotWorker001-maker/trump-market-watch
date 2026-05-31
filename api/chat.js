export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, ...body } = req.body

  // NewsAPI proxy
  if (type === 'news') {
    const { url } = body
    const response = await fetch(url)
    const data = await response.json()
    return res.status(response.status).json(data)
  }

  // Anthropic proxy (default)
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