function stripHtml(html = '') {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateTo200(text = '') {
  if (text.length <= 200) {
    return text;
  }
  // Truncate cleanly at 200 characters max
  const cut = text.slice(0, 197).trim();
  return cut + '…';
}

export default async function handler(req, res) {
  const q = (req.query?.q || '').trim();

  if (!q) {
    return res.status(400).json({
      error: 'invalid_query',
      message: "Query parameter 'q' is required."
    });
  }

  // Guard BEFORE fetch: check if GUARDIAN_API_KEY is configured
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(503).json({
      error: 'missing_credential',
      message: 'GUARDIAN_API_KEY is not configured.'
    });
  }

  try {
    // Search the company name in quotes to prevent broad unquoted token matching
    // Request up to 25 items to ensure enough results remain after excluding affiliate sections
    const quotedQuery = `"${q}"`;
    const guardianUrl = `https://content.guardianapis.com/search?q=${encodeURIComponent(quotedQuery)}&show-fields=body&order-by=newest&page-size=25&api-key=${encodeURIComponent(apiKey)}`;

    let response;
    try {
      response = await fetch(guardianUrl, { signal: AbortSignal.timeout(8000) });
    } catch (netErr) {
      return res.status(504).json({
        error: 'unreachable',
        message: "Can't reach the Guardian."
      });
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({
          error: 'refused',
          message: 'The Guardian rejected our credential.'
        });
      }
      return res.status(502).json({
        error: 'unreachable',
        message: "Can't reach the Guardian."
      });
    }

    const json = await response.json();
    const rawResults = json?.response?.results || [];

    // Filter out affiliate shopping and consumer product reviews
    const filtered = rawResults.filter((item) => {
      const sectionId = (item.sectionId || '').toLowerCase();
      if (sectionId === 'thefilter-us' || sectionId === 'thefilter') {
        return false;
      }
      return true;
    });

    // Top five results: headline, date, section, webUrl, and excerpt truncated strictly to 200 chars
    const results = filtered.slice(0, 5).map((item) => {
      const rawHtmlBody = item.fields?.body || '';
      const textOnly = stripHtml(rawHtmlBody);
      const excerpt = truncateTo200(textOnly);

      return {
        headline: item.webTitle || 'Untitled',
        date: item.webPublicationDate || '',
        section: item.sectionName || 'News',
        webUrl: item.webUrl || '#',
        excerpt: excerpt
      };
    });

    // Cache news 15 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=900, max-age=900');
    return res.status(200).json(results);
  } catch (err) {
    return res.status(502).json({
      error: 'unreachable',
      message: "Can't reach the Guardian."
    });
  }
}
