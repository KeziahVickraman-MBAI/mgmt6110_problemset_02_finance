export default async function handler(req, res) {
  const { lat, lon, date } = req.query || {};

  if (!lat || !lon) {
    return res.status(400).json({
      error: 'invalid_params',
      message: "Parameters 'lat' and 'lon' are required."
    });
  }

  // Guard BEFORE fetch: check if NASA_API_KEY is configured
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(503).json({
      error: 'missing_credential',
      message: 'NASA_API_KEY is not configured.'
    });
  }

  const searchDate = (date || '2024-06-01').trim();

  try {
    // 1. Assets lookup to find nearest available capture date
    const assetsUrl = `https://api.nasa.gov/planetary/earth/assets?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&date=${encodeURIComponent(searchDate)}&dim=0.15&api_key=${encodeURIComponent(apiKey)}`;
    
    let assetsResponse;
    try {
      assetsResponse = await fetch(assetsUrl, { signal: AbortSignal.timeout(6000) });
    } catch (netErr) {
      return res.status(504).json({
        error: 'unreachable',
        message: "Can't reach NASA's imagery service."
      });
    }

    if (!assetsResponse.ok) {
      if (assetsResponse.status === 401 || assetsResponse.status === 403) {
        return res.status(401).json({
          error: 'refused',
          message: 'NASA rejected our credential. No imagery on this screen is current.'
        });
      }
      if (assetsResponse.status === 404) {
        return res.status(404).json({
          error: 'no_capture',
          message: `No cloud-free capture near that date. Nearest available: [date].`
        });
      }
      return res.status(502).json({
        error: 'unreachable',
        message: "Can't reach NASA's imagery service."
      });
    }

    let assetData;
    try {
      assetData = await assetsResponse.json();
    } catch (parseErr) {
      return res.status(502).json({
        error: 'unreachable',
        message: "Can't reach NASA's imagery service."
      });
    }

    const captureDate = assetData?.date
      ? assetData.date.split('T')[0]
      : searchDate;

    // 2. Fetch the actual PNG tile from /planetary/earth/imagery
    const imageryUrl = `https://api.nasa.gov/planetary/earth/imagery?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&date=${encodeURIComponent(captureDate)}&dim=0.15&api_key=${encodeURIComponent(apiKey)}`;

    let imageryResponse;
    try {
      imageryResponse = await fetch(imageryUrl, { signal: AbortSignal.timeout(8000) });
    } catch (netErr) {
      return res.status(504).json({
        error: 'unreachable',
        message: "Can't reach NASA's imagery service."
      });
    }

    if (!imageryResponse.ok) {
      if (imageryResponse.status === 401 || imageryResponse.status === 403) {
        return res.status(401).json({
          error: 'refused',
          message: 'NASA rejected our credential. No imagery on this screen is current.'
        });
      }
      if (imageryResponse.status === 404) {
        return res.status(404).json({
          error: 'no_capture',
          message: `No cloud-free capture near that date. Nearest available: ${captureDate}.`
        });
      }
      return res.status(502).json({
        error: 'unreachable',
        message: "Can't reach NASA's imagery service."
      });
    }

    const imageArrayBuffer = await imageryResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    res.setHeader('Content-Type', imageryResponse.headers.get('content-type') || 'image/png');
    res.setHeader('Capture-Date', captureDate);
    res.setHeader('X-Capture-Date', captureDate);
    res.setHeader('Access-Control-Expose-Headers', 'Capture-Date, X-Capture-Date');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
    return res.status(200).send(imageBuffer);
  } catch (err) {
    return res.status(502).json({
      error: 'unreachable',
      message: "Can't reach NASA's imagery service."
    });
  }
}
