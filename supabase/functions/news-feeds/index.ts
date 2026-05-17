const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEEDS = [
  { name: 'MBW',       url: 'https://www.musicbusinessworldwide.com/feed/',  cat: 'industry' },
  { name: 'HYPEBOT',   url: 'https://www.hypebot.com/hypebot/atom.xml',      cat: 'industry' },
  { name: 'BILLBOARD', url: 'https://www.billboard.com/feed/',               cat: 'industry' },
  { name: 'IQ MAG',    url: 'https://www.iqmag.net/feed/',                   cat: 'touring'  },
  { name: 'FOH',       url: 'https://www.fohonline.com/feed/',               cat: 'tech'     },
  { name: 'SOS',       url: 'https://www.soundonsound.com/feed',             cat: 'tech'     },
];

function getTag(text: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(text);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function getLinkHref(text: string): string {
  const m = /<link[^>]+href="([^"]+)"/.exec(text);
  if (m) return m[1];
  return getTag(text, 'link').split('<')[0].trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
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
  const pat = /<(item|entry)[\s>]([\s\S]*?)<\/\1>/gi;
  const items = [];
  let m;
  while ((m = pat.exec(text)) !== null && items.length < 6) {
    const c = m[2];
    const title = decodeEntities(getTag(c, 'title'));
    if (!title) continue;
    const link    = getLinkHref(c) || getTag(c, 'guid');
    const dateStr = getTag(c, 'pubDate') || getTag(c, 'published') || getTag(c, 'updated');
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
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      if (!r.ok) throw new Error(`${feed.name}: HTTP ${r.status}`);
      return parseFeed(await r.text(), feed);
    })
  );

  const items = results
    .filter((r): r is PromiseFulfilledResult<typeof []> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());

  return new Response(JSON.stringify(items), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
