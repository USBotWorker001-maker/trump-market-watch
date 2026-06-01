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
    const { url, pages = 1 } = body

    function parseXml(xml) {
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
      return items
    }

    try {
      // Fetch up to `pages` pages — Truth Social RSS supports ?page=N
      const pageNums = Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1)
      const results = await Promise.allSettled(
        pageNums.map(n => {
          const pageUrl = n === 1 ? url : `${url}?page=${n}`
          return fetch(pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrumpMarketWatch/1.0)' },
          }).then(r => r.text())
        })
      )

      const allItems = []
      const seen = new Set()
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        for (const item of parseXml(r.value)) {
          if (!seen.has(item.link)) { allItems.push(item); seen.add(item.link) }
        }
      }

      // Filter to last `days` days if specified
      const { days } = body
      const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0
      const filtered = cutoff
        ? allItems.filter(i => new Date(i.pubDate).getTime() >= cutoff)
        : allItems

      return res.status(200).json({ items: filtered })
    } catch (e) {
      return res.status(500).json({ error: e.message, items: [] })
    }
  }

  // ─── Congressional trades proxy ──────────────────────────────────────────
  if (type === 'congress') {
    const TRUMP_ALLIES = new Set([
      'Tommy Tuberville','Markwayne Mullin','Rick Scott','Rand Paul','Ted Cruz',
      'Josh Hawley','Mike Lee','Ron Johnson','Bill Hagerty','Roger Marshall',
      'John Kennedy','Marsha Blackburn','Lindsey Graham','Marco Rubio','JD Vance',
      'Katie Britt','Eric Schmitt','Pete Ricketts','Cynthia Lummis','Kevin Cramer',
      'Steve Daines','Chuck Grassley','Matt Gaetz','Marjorie Taylor Greene',
      'Jim Jordan','Lauren Boebert','Paul Gosar','Andy Biggs','Scott Perry',
      'Byron Donalds','Anna Paulina Luna','Mike Collins','Clay Higgins',
      'Jeff Duncan','Barry Moore','Bob Good','Chip Roy','Thomas Massie',
      'Troy Nehls','Randy Weber','Greg Steube','Bill Posey','Michael Cloud',
      'Wesley Hunt','Brian Babin','Pete Sessions','Ronny Jackson','Pat Fallon',
      'Morgan Luttrell','Michael Burgess','Michael McCaul','Michael Guest',
      'Trent Kelly','Steven Palazzo','Mike Bost','Mary Miller','Mike Johnson',
      'Steve Scalise','Elise Stefanik','Tom Emmer','Gary Palmer','Robert Aderholt',
      'Barry Loudermilk','Rick Allen','Andrew Clyde','Buddy Carter',
    ])

    try {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000 // last 90 days

      const [houseRes, senateRes] = await Promise.allSettled([
        fetch('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json'),
        fetch('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json'),
      ])

      const allTrades = []

      if (houseRes.status === 'fulfilled' && houseRes.value.ok) {
        const houseData = await houseRes.value.json()
        const rows = Array.isArray(houseData) ? houseData : (houseData.data ?? [])
        for (const t of rows) {
          const name = t.representative ?? ''
          if (!TRUMP_ALLIES.has(name)) continue
          const tDate = new Date(t.transaction_date ?? t.disclosure_date ?? '')
          if (tDate.getTime() < cutoff) continue
          allTrades.push({
            id:              `house-${name}-${t.transaction_date}-${t.ticker}`,
            representative:  name,
            chamber:         'House',
            ticker:          t.ticker ?? '',
            asset:           t.asset_description ?? t.asset ?? '',
            type:            t.type ?? '',
            amount:          t.amount ?? '',
            transactionDate: t.transaction_date ?? '',
            disclosureDate:  t.disclosure_date ?? '',
          })
        }
      }

      if (senateRes.status === 'fulfilled' && senateRes.value.ok) {
        const senateData = await senateRes.value.json()
        const rows = Array.isArray(senateData) ? senateData : (senateData.data ?? [])
        for (const t of rows) {
          const name = t.senator ?? t.representative ?? ''
          if (!TRUMP_ALLIES.has(name)) continue
          const tDate = new Date(t.transaction_date ?? t.disclosure_date ?? '')
          if (tDate.getTime() < cutoff) continue
          allTrades.push({
            id:              `senate-${name}-${t.transaction_date}-${t.ticker}`,
            representative:  name,
            chamber:         'Senate',
            ticker:          t.ticker ?? '',
            asset:           t.asset_description ?? t.asset ?? '',
            type:            t.type ?? t.transaction_type ?? '',
            amount:          t.amount ?? '',
            transactionDate: t.transaction_date ?? '',
            disclosureDate:  t.disclosure_date ?? '',
          })
        }
      }

      allTrades.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
      return res.status(200).json({ trades: allTrades })
    } catch (e) {
      return res.status(500).json({ error: e.message, trades: [] })
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
