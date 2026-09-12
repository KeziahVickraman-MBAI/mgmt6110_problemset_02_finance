// FACILITIES: symbol -> { lat, lon, label }
// Hardcoded facility coordinate mappings for known corporate headquarters / key production sites.
export const FACILITIES = {
  WMT: {
    lat: 36.3667,
    lon: -94.2180,
    label: "Walmart Home Office & Global HQ, Bentonville, AR"
  },
  AAPL: {
    lat: 37.3349,
    lon: -122.0090,
    label: "Apple Park Campus, Cupertino, CA"
  },
  TSLA: {
    lat: 30.2223,
    lon: -97.6171,
    label: "Tesla Gigafactory Texas, Austin, TX"
  },
  AMZN: {
    lat: 47.6155,
    lon: -122.3398,
    label: "Amazon Corporate Headquarters & Spheres, Seattle, WA"
  },
  MSFT: {
    lat: 47.6423,
    lon: -122.1368,
    label: "Microsoft Redmond Main Campus, Redmond, WA"
  },
  GOOGL: {
    lat: 37.4220,
    lon: -122.0841,
    label: "Googleplex World Headquarters, Mountain View, CA"
  },
  GOOG: {
    lat: 37.4220,
    lon: -122.0841,
    label: "Googleplex World Headquarters, Mountain View, CA"
  },
  NVDA: {
    lat: 37.3708,
    lon: -121.9634,
    label: "NVIDIA Voyager & Endeavor Headquarters, Santa Clara, CA"
  },
  META: {
    lat: 37.4848,
    lon: -122.1484,
    label: "Meta Menlo Park Headquarters (1 Hacker Way), Menlo Park, CA"
  },
  BA: {
    lat: 47.9252,
    lon: -122.2715,
    label: "Boeing Everett Production Facility, Everett, WA"
  },
  INTC: {
    lat: 45.5428,
    lon: -122.9238,
    label: "Intel Ronler Acres Campus, Hillsboro, OR"
  },
  F: {
    lat: 42.3045,
    lon: -83.1558,
    label: "Ford River Rouge Complex, Dearborn, MI"
  },
  GM: {
    lat: 42.3831,
    lon: -83.0450,
    label: "GM Factory ZERO EV Assembly Center, Detroit, MI"
  },
  CAT: {
    lat: 40.8172,
    lon: -89.5786,
    label: "Caterpillar Global Engine Facility, Mossville, IL"
  },
  XOM: {
    lat: 30.0886,
    lon: -95.4265,
    label: "ExxonMobil Houston Campus, Spring, TX"
  },
  CVX: {
    lat: 37.7699,
    lon: -121.9568,
    label: "Chevron San Ramon Headquarters, San Ramon, CA"
  },
  DIS: {
    lat: 34.1565,
    lon: -118.3251,
    label: "Walt Disney Studios, Burbank, CA"
  },
  NKE: {
    lat: 45.5085,
    lon: -122.8276,
    label: "Nike World Headquarters, Beaverton, OR"
  },
  NFLX: {
    lat: 37.2431,
    lon: -121.9689,
    label: "Netflix Corporate Headquarters, Los Gatos, CA"
  },
  AMD: {
    lat: 37.3789,
    lon: -121.9678,
    label: "AMD Corporate Headquarters, Santa Clara, CA"
  },
  JNJ: {
    lat: 40.4988,
    lon: -74.4449,
    label: "Johnson & Johnson One J&J Plaza, New Brunswick, NJ"
  },
  PFE: {
    lat: 40.7516,
    lon: -73.9723,
    label: "Pfizer World Headquarters, New York, NY"
  },
  JPM: {
    lat: 40.7558,
    lon: -73.9754,
    label: "JPMorgan Chase Global HQ (270 Park Ave), New York, NY"
  },
  KO: {
    lat: 33.7712,
    lon: -84.3969,
    label: "Coca-Cola Global Headquarters, Atlanta, GA"
  }
};

// Global queue and cache for Alpha Vantage to enforce >= 1100ms sequencing
let lastAvCallTime = 0;
const avMutex = {
  lock: Promise.resolve()
};

export async function scheduleAvCall(fn) {
  const currentLock = avMutex.lock;
  let release;
  avMutex.lock = new Promise((resolve) => {
    release = resolve;
  });

  await currentLock;
  try {
    const now = Date.now();
    const elapsed = now - lastAvCallTime;
    if (elapsed < 1200) {
      await new Promise((r) => setTimeout(r, 1200 - elapsed));
    }
    const result = await fn();
    lastAvCallTime = Date.now();
    return result;
  } finally {
    release();
  }
}

// 7-day memory cache for symbol search
const searchCache = new Map();
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  const q = (req.query?.q || '').trim();

  if (!q) {
    return res.status(400).json({
      error: 'invalid_query',
      message: "Query parameter 'q' is required."
    });
  }

  // Guard BEFORE fetch: check if ALPHAVANTAGE_API_KEY is configured
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(503).json({
      error: 'missing_credential',
      message: 'ALPHAVANTAGE_API_KEY is not configured.'
    });
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=604800, max-age=604800');
    return res.status(200).json(cached.data);
  }

  const fetchSearch = async () => {
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return { status: response.status, ok: false };
    }
    const data = await response.json();
    return { ok: true, data };
  };

  try {
    let result = await scheduleAvCall(fetchSearch);

    // Alpha Vantage throttling detection: 200 OK carrying "Information" or "Note"
    if (result.ok && (result.data?.Information || result.data?.Note)) {
      // On throttle, wait 1200ms and retry ONCE
      await new Promise((r) => setTimeout(r, 1200));
      result = await scheduleAvCall(fetchSearch);
    }

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        return res.status(result.status).json({
          error: 'refused',
          message: "We can't reach the company lookup right now."
        });
      }
      return res.status(502).json({
        error: 'unreachable',
        message: "We can't reach the company lookup right now."
      });
    }

    const payload = result.data;
    if (payload?.Information || payload?.Note) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Company lookup is rate-limited. Try again in a moment.'
      });
    }

    if (payload?.['Error Message']) {
      return res.status(401).json({
        error: 'refused',
        message: "We can't reach the company lookup right now."
      });
    }

    const rawMatches = payload?.bestMatches || [];
    const topMatches = rawMatches.slice(0, 5).map((item) => {
      const symbol = item['1. symbol'];
      const name = item['2. name'];
      const region = item['4. region'];
      const facility = FACILITIES[symbol] || null;

      return {
        symbol,
        name,
        region,
        facility: facility
          ? {
              lat: facility.lat,
              lon: facility.lon,
              label: facility.label
            }
          : null
      };
    });

    searchCache.set(cacheKey, {
      data: topMatches,
      timestamp: Date.now()
    });

    res.setHeader('Cache-Control', 'public, s-maxage=604800, max-age=604800');
    return res.status(200).json(topMatches);
  } catch (err) {
    return res.status(502).json({
      error: 'unreachable',
      message: "We can't reach the company lookup right now."
    });
  }
}
