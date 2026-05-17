const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google News RSS — always accessible from server-side, never blocked
const FEEDS = [
  { name: 'TOURING',  cat: 'touring',  q: 'concert+tour+live+music+production' },
  { name: 'INDUSTRY', cat: 'industry', q: 'music+industry+business+streaming' },
  { name: 'VENUES',   cat: 'venues',   q: 'concert+venue+arena+amphitheater' },
  { name: 'TECH',     cat: 'tech',     q: 'live+sound+audio+production+lighting+rigging' },
];

function gnewsUrl(q: string) {
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

function getTag(text: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(text);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function relTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

function parseFeed(text: string, feed: typeof FEEDS[0]) {
  const pat = /<item[\s>]([\s\S]*?)<\/item>/gi;
  const items = [];
  let m;
  while ((m = pat.exec(text)) !== null && items.length < 8) {
    const c = m[1];
    const title = decodeEntities(getTag(c, 'title'));
    if (!title) continue;
    const link    = getTag(c, 'link').split('<')[0].trim() || getTag(c, 'guid');
    const dateStr = getTag(c, 'pubDate');
    const date    = dateStr ? new Date(dateStr) : new Date(0);
    items.push({
      src: feed.name, cat: feed.cat, title, link,
      time: relTime(dateStr),
      hot:  date.getTime() > Date.now() - 2 * 3_600_000,
      _date: date.toISOString(),
    });
  }
  return items;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const r = await fetch(gnewsUrl(feed.q));
      if (!r.ok) throw new Error(`${feed.name}: HTTP ${r.status}`);
      return parseFeed(await r.text(), feed);
    })
  );

  const errors = results
    .map((r, i) => r.status === 'rejected' ? `${FEEDS[i].name}: ${(r as PromiseRejectedResult).reason?.message}` : null)
    .filter(Boolean);

  if (errors.length) console.warn('[news-feeds] partial failures:', errors.join(', '));

  const items = results
    .filter((r): r is PromiseFulfilledResult<typeof []> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());

  return new Response(JSON.stringify({ items, errors }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
