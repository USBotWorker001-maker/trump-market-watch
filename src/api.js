async function fetchTrumpStockNews() {
  const today = new Date().toISOString().split('T')[0]
  const newsUrl = `https://newsapi.org/v2/everything?q=Trump+stock+OR+Trump+shares+OR+Trump+company+OR+Trump+tariff&language=en&from=${today}&sortBy=publishedAt&pageSize=20&apiKey=${NEWSAPI_KEY}`
  
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'news', url: newsUrl }),
  })
  
  const data = await res.json()
  if (!data.articles) return []
  return data.articles.map(a => ({
    title: a.title,
    description: a.description,
    url: a.url,
    publishedAt: a.publishedAt,
  }))
}