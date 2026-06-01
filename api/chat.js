export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, ...body } = req.body

  // ─── NewsAPI proxy ───────────────────────────────────────────────────────
  if (type === 'news') {
    const { query, from } = body
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&from=${from}&sortBy=publishedAt&pageSize=20&apiKey=${process.env.VITE_NEWSAPI_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    return res.status(response.status).json(data)
  }

  // ─── RSS proxy (Truth Social, White House) ───────────────────────────────
  if (type === 'rss') {
    const { url } = body
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrumpMarketWatch/1.0)' },
      })
      const xml = await response.text()

      // Parse <item> blocks from RSS XML
      const items = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1]
        const get = (tag) => {
          const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
          return m ? (m[1] ?? m[2] ?? '').trim() : ''
        }
        items.push({
          title:   get('title'),
          link:    get('link'),
          pubDate: get('pubDate'),
          content: get('content:encoded') || get('description'),
        })
      }
      return res.status(200).json({ items })
    } catch (e) {
      return res.status(500).json({ error: e.message, items: [] })
    }
  }

  // ─── Anthropic proxy ─────────────────────────────────────────────────────
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
