// Types
interface Facility {
  lat: number;
  lon: number;
  label: string;
}

interface CompanyMatch {
  symbol: string;
  name: string;
  region: string;
  facility: Facility | null;
}

interface PricePoint {
  date: string;
  close: number;
}

interface PriceData {
  symbol: string;
  prices: PricePoint[];
  lastRefreshed?: string;
  stale?: boolean;
  cachedAt?: string;
}

interface NewsItem {
  headline: string;
  date: string;
  section: string;
  webUrl: string;
  excerpt: string;
}

interface ProviderHealth {
  provider: string;
  keyConfigured: boolean;
  answered: boolean;
  status: number | null;
  state: 'up' | 'degraded' | 'down';
}

interface HealthData {
  satellite: ProviderHealth;
  news: ProviderHealth;
  price: ProviderHealth;
}

// Current Application State
interface State {
  selectedCompany: CompanyMatch | null;
  searchQuery: string;
  searchMatches: CompanyMatch[];
  searchState: 'idle' | 'loading' | 'empty' | 'rate-limited' | 'refused';
  satelliteState: 'idle' | 'loading' | 'loaded' | 'no-facility' | 'no-capture' | 'refused' | 'unreachable';
  satelliteImageUrl: string | null;
  satelliteCaptureDate: string | null;
  satelliteNoCaptureDate: string | null;
  priceState: 'idle' | 'loading' | 'loaded' | 'empty' | 'rate-limited' | 'refused' | 'unreachable';
  priceData: PriceData | null;
  priceRateLimitedTime: string | null;
  newsState: 'idle' | 'loading' | 'loaded' | 'empty' | 'refused' | 'unreachable';
  newsItems: NewsItem[];
  health: HealthData | null;
}

const state: State = {
  selectedCompany: null,
  searchQuery: '',
  searchMatches: [],
  searchState: 'idle',
  satelliteState: 'idle',
  satelliteImageUrl: null,
  satelliteCaptureDate: null,
  satelliteNoCaptureDate: null,
  priceState: 'idle',
  priceData: null,
  priceRateLimitedTime: null,
  newsState: 'idle',
  newsItems: [],
  health: null
};

// Default seed company (Walmart - WMT)
const DEFAULT_COMPANY: CompanyMatch = {
  symbol: 'WMT',
  name: 'Walmart Inc',
  region: 'United States',
  facility: {
    lat: 36.3667,
    lon: -94.2180,
    label: 'Walmart Home Office & Global HQ, Bentonville, AR'
  }
};

// Date formatting helper
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// Generate Inline SVG Price Chart (no charting library)
function generatePriceChartSvg(prices: PricePoint[]): string {
  if (!prices || prices.length < 2) return '';

  const width = 340;
  const height = 180;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 26;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const closes = prices.map((p) => p.close);
  const minPrice = Math.min(...closes);
  const maxPrice = Math.max(...closes);
  const priceRange = maxPrice - minPrice || 1;

  const getX = (index: number) => padLeft + (index / (prices.length - 1)) * chartW;
  const getY = (price: number) => padTop + chartH - ((price - minPrice) / priceRange) * chartH;

  const points = prices.map((p, i) => `${getX(i).toFixed(1)},${getY(p.close).toFixed(1)}`).join(' ');
  const firstX = getX(0).toFixed(1);
  const lastX = getX(prices.length - 1).toFixed(1);
  const bottomY = (padTop + chartH).toFixed(1);
  const areaPath = `M ${firstX},${bottomY} L ${points} L ${lastX},${bottomY} Z`;

  const midPrice = minPrice + priceRange / 2;
  const isUp = prices[prices.length - 1].close >= prices[0].close;
  const strokeColor = isUp ? '#059669' : '#dc2626';
  const fillColor = isUp ? 'rgba(5, 150, 105, 0.08)' : 'rgba(220, 38, 38, 0.08)';

  return `
    <svg class="price-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.18" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.01" />
        </linearGradient>
      </defs>

      <!-- Horizontal grid guides -->
      <line x1="${padLeft}" y1="${getY(maxPrice).toFixed(1)}" x2="${padLeft + chartW}" y2="${getY(maxPrice).toFixed(1)}" stroke="#e5e7eb" stroke-dasharray="2,2" stroke-width="1" />
      <line x1="${padLeft}" y1="${getY(midPrice).toFixed(1)}" x2="${padLeft + chartW}" y2="${getY(midPrice).toFixed(1)}" stroke="#f3f4f6" stroke-dasharray="2,2" stroke-width="1" />
      <line x1="${padLeft}" y1="${getY(minPrice).toFixed(1)}" x2="${padLeft + chartW}" y2="${getY(minPrice).toFixed(1)}" stroke="#e5e7eb" stroke-dasharray="2,2" stroke-width="1" />

      <!-- Price Labels on Y-axis -->
      <text x="${padLeft - 6}" y="${(getY(maxPrice) + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#6b7280" font-family="monospace">$${maxPrice.toFixed(2)}</text>
      <text x="${padLeft - 6}" y="${(getY(minPrice) + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#6b7280" font-family="monospace">$${minPrice.toFixed(2)}</text>

      <!-- Area fill -->
      <path d="${areaPath}" fill="url(#priceGradient)" />

      <!-- Price polyline -->
      <polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Endpoint circle -->
      <circle cx="${lastX}" cy="${getY(prices[prices.length - 1].close).toFixed(1)}" r="3.5" fill="${strokeColor}" />

      <!-- Date bounds on X-axis -->
      <text x="${padLeft}" y="${height - 6}" text-anchor="start" font-size="9.5" fill="#9ca3af">${formatDate(prices[0].date)}</text>
      <text x="${padLeft + chartW}" y="${height - 6}" text-anchor="end" font-size="9.5" fill="#9ca3af">${formatDate(prices[prices.length - 1].date)}</text>
    </svg>
  `;
}

// Render the entire app UI
function render() {
  const root = document.getElementById('root');
  if (!root) return;

  const comp = state.selectedCompany;
  const symbol = comp ? comp.symbol : '—';
  const name = comp ? comp.name : 'Select a company';
  const region = comp ? comp.region : '—';
  const facilityLabel = comp?.facility ? comp.facility.label : 'No mapped facility in database';

  // Status dot indicators helper
  const getStatusChip = (providerKey: 'satellite' | 'news' | 'price', label: string) => {
    const p = state.health ? state.health[providerKey] : null;
    let badgeClass = 'bg-stone-100 text-stone-700 border-stone-200';
    let dotClass = 'bg-stone-400';
    let statusText = 'checking…';

    if (p) {
      if (p.state === 'up') {
        badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        dotClass = 'bg-emerald-500';
        statusText = 'up';
      } else if (p.state === 'degraded') {
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
        dotClass = 'bg-amber-500';
        statusText = 'degraded';
      } else {
        badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
        dotClass = 'bg-rose-500';
        statusText = 'down';
      }
    }

    return `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${badgeClass}">
        <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
        <span>${label}: ${statusText}</span>
      </div>
    `;
  };

  root.innerHTML = `
    <div class="max-w-[1100px] mx-auto px-4 py-6 sm:px-6">

      <!-- PANEL 0 · SEARCH (Pinned Top) -->
      <section id="panel-search" class="sticky top-0 z-30 bg-[#f7f8f9]/95 backdrop-blur-md pt-2 pb-4 border-b border-[#e5e7eb] mb-6">
        <form id="search-form" class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1">
            <input
              id="search-input"
              type="text"
              autocomplete="off"
              placeholder="Company name or ticker"
              value="${state.searchQuery}"
              class="w-full h-11 px-4 text-base bg-white border border-[#d1d5db] rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 placeholder:text-neutral-400"
            />
          </div>
          <button
            id="search-submit"
            type="submit"
            class="h-11 px-6 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Lookup
          </button>
        </form>

        <!-- Search Status & State Messages -->
        ${
          state.searchState === 'loading'
            ? `<div class="mt-2.5 text-xs text-neutral-600 font-medium animate-pulse">Looking up companies…</div>`
            : ''
        }
        ${
          state.searchState === 'empty'
            ? `<div class="mt-2.5 text-xs text-neutral-600 font-medium">No companies match that name. Try the ticker instead.</div>`
            : ''
        }
        ${
          state.searchState === 'rate-limited'
            ? `<div class="mt-2.5 text-xs text-amber-700 font-medium">Company lookup is rate-limited. Try again in a moment.</div>`
            : ''
        }
        ${
          state.searchState === 'refused'
            ? `<div class="mt-2.5 text-xs text-rose-700 font-medium">We can't reach the company lookup right now.</div>`
            : ''
        }

        <!-- Pick List of Up to Five Matches -->
        ${
          state.searchMatches.length > 0
            ? `
            <div class="mt-2.5 bg-white border border-[#e5e7eb] rounded-lg shadow-sm overflow-hidden divide-y divide-[#f3f4f6]">
              <div class="px-3 py-1.5 bg-[#f9fafb] text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Select Listing
              </div>
              ${state.searchMatches
                .map(
                  (m) => `
                <button
                  type="button"
                  data-symbol="${m.symbol}"
                  class="search-result-row w-full text-left px-3.5 py-2.5 hover:bg-[#f3f4f6] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div class="min-w-0">
                    <span class="font-mono font-bold text-sm text-neutral-900 mr-2">${m.symbol}</span>
                    <span class="text-sm text-neutral-700 truncate">${m.name}</span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">${m.region}</span>
                    ${
                      m.facility
                        ? `<span class="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Facility mapped</span>`
                        : ''
                    }
                  </div>
                </button>
              `
                )
                .join('')}
            </div>
          `
            : ''
        }

        <!-- Quick suggestion pills for testing -->
        <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span class="font-medium text-neutral-400">Quick test:</span>
          ${['WMT', 'AAPL', 'TSLA', 'NVDA', 'BA', 'CAT']
            .map(
              (sym) => `
            <button
              type="button"
              data-quick-symbol="${sym}"
              class="quick-pick-btn px-2 py-0.5 bg-white border border-[#e5e7eb] hover:border-neutral-400 rounded text-neutral-700 font-mono text-[11px] transition-colors cursor-pointer"
            >
              ${sym}
            </button>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- PANEL A · COMPANY HEADER -->
      <section id="panel-header" class="bg-white border border-[#e5e7eb] rounded-xl p-5 mb-6 shadow-2xs">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-2xl font-bold text-neutral-900 tracking-tight">${name}</h1>
              <span class="px-2.5 py-0.5 text-xs font-mono font-semibold bg-neutral-100 text-neutral-800 rounded-md border border-neutral-200">
                ${symbol}
              </span>
              <span class="text-xs text-neutral-500 font-medium">
                ${region}
              </span>
            </div>
            <div class="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
              <svg class="w-3.5 h-3.5 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="font-medium text-neutral-700">${facilityLabel}</span>
            </div>
          </div>

          <!-- Three Provider Status Chips -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            ${getStatusChip('satellite', 'Satellite')}
            ${getStatusChip('news', 'News')}
            ${getStatusChip('price', 'Price')}
          </div>
        </div>
      </section>

      <!-- TWO-THIRDS / ONE-THIRD SPLIT (Satellite Left, Price Right) -->
      <div class="dashboard-grid mb-6">

        <!-- PANEL B · SATELLITE (Left 2/3) -->
        <section id="panel-satellite" class="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-2xs flex flex-col justify-between satellite-panel-body">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xs font-bold tracking-wider uppercase text-neutral-500">
                Main Facility · Landsat Orbit
              </h2>
              ${
                state.satelliteCaptureDate
                  ? `<span class="text-xs font-mono text-neutral-500">Capture: ${state.satelliteCaptureDate}</span>`
                  : ''
              }
            </div>

            <!-- Imagery Viewport with reserved height -->
            <div class="relative w-full h-[280px] bg-neutral-100 rounded-lg overflow-hidden border border-[#e5e7eb] flex items-center justify-center text-center p-6">
              ${
                state.satelliteState === 'loading'
                  ? `
                <div class="flex flex-col items-center gap-2">
                  <div class="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin"></div>
                  <p class="text-sm text-neutral-600 font-medium">Fetching imagery…</p>
                </div>
              `
                  : ''
              }

              ${
                state.satelliteState === 'loaded' && state.satelliteImageUrl
                  ? `
                <img
                  src="${state.satelliteImageUrl}"
                  alt="Satellite capture of ${facilityLabel}"
                  class="w-full h-full object-cover"
                />
              `
                  : ''
              }

              ${
                state.satelliteState === 'no-facility'
                  ? `
                <div class="max-w-md">
                  <p class="text-sm text-neutral-600">
                    We don't have a mapped facility for this company. Add one to FACILITIES to see imagery.
                  </p>
                </div>
              `
                  : ''
              }

              ${
                state.satelliteState === 'no-capture'
                  ? `
                <div class="max-w-md">
                  <p class="text-sm text-neutral-600">
                    No cloud-free capture near that date. Nearest available: ${state.satelliteNoCaptureDate || '[date]'}.
                  </p>
                </div>
              `
                  : ''
              }

              ${
                state.satelliteState === 'refused'
                  ? `
                <div class="max-w-md">
                  <p class="text-sm text-neutral-700 font-medium">
                    NASA rejected our credential. No imagery on this screen is current.
                  </p>
                </div>
              `
                  : ''
              }

              ${
                state.satelliteState === 'unreachable' || state.satelliteState === 'idle'
                  ? `
                <div class="max-w-md">
                  <div class="w-8 h-8 mx-auto mb-2 text-neutral-400">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-12.728a5 5 0 017.072 0l-2.828 2.828" />
                    </svg>
                  </div>
                  <p class="text-sm text-neutral-600 font-medium">
                    Can't reach NASA's imagery service.
                  </p>
                  <p class="text-xs text-neutral-400 mt-1.5">
                    Service proxy unavailable from upstream NASA endpoint.
                  </p>
                </div>
              `
                  : ''
              }
            </div>

            <!-- Capture Date beneath image -->
            <div class="mt-2 text-xs text-neutral-500 font-mono">
              ${
                state.satelliteCaptureDate
                  ? `Captured: ${state.satelliteCaptureDate}`
                  : `<span class="text-neutral-400">No active tile captured</span>`
              }
            </div>
          </div>

          <!-- Fixed Caption, ALWAYS VISIBLE -->
          <div class="mt-4 pt-3 border-t border-[#f3f4f6]">
            <p class="text-xs text-neutral-500 leading-relaxed">
              Landsat 8, roughly 30m per pixel, 16-day revisit. Shows site context and long-run change. It cannot resolve vehicles and is not a demand or revenue signal.
            </p>
          </div>
        </section>

        <!-- PANEL C · PRICE (Right 1/3) -->
        <section id="panel-price" class="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-2xs flex flex-col justify-between price-panel-body">
          <div>
            <h2 class="text-xs font-bold tracking-wider uppercase text-neutral-500 mb-2">
              Share Price · Ninety-Day Close
            </h2>

            ${(() => {
              if (state.priceState === 'loading') {
                return `
                  <div class="h-[260px] flex flex-col items-center justify-center gap-2">
                    <div class="w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin"></div>
                    <p class="text-sm text-neutral-600 font-medium">Loading ninety days of closes…</p>
                  </div>
                `;
              }

              if (state.priceState === 'empty') {
                return `
                  <div class="h-[260px] flex items-center justify-center text-center p-4">
                    <p class="text-sm text-neutral-600">No price history for this symbol. It may be delisted or not covered.</p>
                  </div>
                `;
              }

              if (state.priceState === 'refused') {
                return `
                  <div class="h-[260px] flex items-center justify-center text-center p-4">
                    <p class="text-sm text-rose-700 font-medium">The price provider rejected our credential.</p>
                  </div>
                `;
              }

              if (state.priceState === 'unreachable') {
                return `
                  <div class="h-[260px] flex items-center justify-center text-center p-4">
                    <p class="text-sm text-neutral-600 font-medium">Can't reach the price provider.</p>
                  </div>
                `;
              }

              if (state.priceState === 'rate-limited' && !state.priceData?.prices?.length) {
                return `
                  <div class="h-[260px] flex items-center justify-center text-center p-4">
                    <p class="text-sm text-amber-800 font-medium">Price data is rate-limited right now. Try again in a moment.</p>
                  </div>
                `;
              }

              // Loaded (or rate-limited serving stale cache)
              const prices = state.priceData?.prices || [];
              if (prices.length > 0) {
                const firstClose = prices[0].close;
                const lastClose = prices[prices.length - 1].close;
                const diff = lastClose - firstClose;
                const pct = (diff / firstClose) * 100;
                const isPos = diff >= 0;
                const sign = isPos ? '+' : '';

                return `
                  <!-- Leading with the ninety-day trend rather than today's number -->
                  <div class="mt-1 mb-3">
                    <div class="flex items-baseline gap-2">
                      <span class="text-2xl font-bold font-mono tracking-tight ${isPos ? 'text-emerald-700' : 'text-rose-700'}">
                        ${sign}${pct.toFixed(2)}%
                      </span>
                      <span class="text-xs font-semibold px-1.5 py-0.5 rounded ${isPos ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}">
                        ${sign}$${diff.toFixed(2)} 90d
                      </span>
                    </div>

                    <div class="text-xs text-neutral-500 mt-1 flex items-center justify-between">
                      <span>Last close: <strong class="text-neutral-800 font-mono font-semibold">$${lastClose.toFixed(2)}</strong></span>
                      <span class="font-mono text-[11px]">${formatDate(prices[prices.length - 1].date)}</span>
                    </div>

                    ${
                      state.priceData?.stale || state.priceState === 'rate-limited'
                        ? `
                      <div class="mt-2 text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        Price data is rate-limited right now. Showing the last figures we have, from ${formatTime(state.priceData?.cachedAt || '')}.
                      </div>
                    `
                        : ''
                    }
                  </div>

                  <!-- Inline SVG Chart -->
                  <div class="mt-2 bg-[#fcfdfd] border border-[#f3f4f6] rounded-lg p-1.5">
                    ${generatePriceChartSvg(prices)}
                  </div>
                `;
              }

              return `
                <div class="h-[260px] flex items-center justify-center text-center p-4">
                  <p class="text-sm text-neutral-400">Enter a company ticker above to inspect 90-day closes.</p>
                </div>
              `;
            })()}
          </div>

          <div class="mt-4 pt-3 border-t border-[#f3f4f6] text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Daily closes (compact)</span>
            <span>Alpha Vantage</span>
          </div>
        </section>

      </div>

      <!-- PANEL D · NEWS (Full Width Beneath as Five Rows Rather than Cards) -->
      <section id="panel-news" class="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-2xs mb-8 news-panel-body">
        <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#f3f4f6]">
          <h2 class="text-xs font-bold tracking-wider uppercase text-neutral-500">
            Recent Coverage · The Guardian (Newest First)
          </h2>
          <span class="text-[11px] text-neutral-400">Summary Only Licence</span>
        </div>

        ${(() => {
          if (state.newsState === 'loading') {
            return `
              <div class="h-[320px] flex flex-col items-center justify-center gap-2">
                <div class="w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin"></div>
                <p class="text-sm text-neutral-600 font-medium">Searching recent coverage…</p>
              </div>
            `;
          }

          if (state.newsState === 'empty') {
            return `
              <div class="h-[240px] flex items-center justify-center text-center p-6">
                <p class="text-sm text-neutral-600 max-w-md">
                  No Guardian coverage of this company in the archive. That's not unusual for smaller listings.
                </p>
              </div>
            `;
          }

          if (state.newsState === 'refused') {
            return `
              <div class="h-[240px] flex items-center justify-center text-center p-6">
                <p class="text-sm text-rose-700 font-medium">The Guardian rejected our credential.</p>
              </div>
            `;
          }

          if (state.newsState === 'unreachable') {
            return `
              <div class="h-[240px] flex items-center justify-center text-center p-6">
                <p class="text-sm text-neutral-600 font-medium">Can't reach the Guardian.</p>
              </div>
            `;
          }

          if (state.newsItems.length > 0) {
            return `
              <div class="divide-y divide-[#f3f4f6]">
                ${state.newsItems
                  .map(
                    (item) => `
                  <article class="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3 group">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-neutral-100 text-neutral-700 rounded">
                          ${item.section}
                        </span>
                        <time class="text-xs text-neutral-400 font-mono">
                          ${formatDate(item.date)}
                        </time>
                      </div>
                      <h3 class="text-base font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                        <a href="${item.webUrl}" target="_blank" rel="noopener noreferrer" class="hover:underline">
                          ${item.headline}
                        </a>
                      </h3>
                      <!-- Excerpt truncated strictly to 200 characters server-side -->
                      <p class="mt-1 text-sm text-neutral-600 leading-relaxed font-normal">
                        ${item.excerpt}
                      </p>
                    </div>

                    <a
                      href="${item.webUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="shrink-0 self-start mt-1 text-xs text-neutral-400 group-hover:text-neutral-900 flex items-center gap-1 font-medium transition-colors"
                      title="Open full article on The Guardian"
                    >
                      Read
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </article>
                `
                  )
                  .join('')}
              </div>
            `;
          }

          return `
            <div class="h-[240px] flex items-center justify-center text-center p-6">
              <p class="text-sm text-neutral-400">Select a company to load recent journalistic coverage.</p>
            </div>
          `;
        })()}
      </section>

      <!-- FOOTER -->
      <footer class="pt-6 border-t border-[#e5e7eb] text-xs text-neutral-500 leading-relaxed flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <a href="https://www.theguardian.com" target="_blank" rel="noopener noreferrer" class="hover:text-neutral-800 underline underline-offset-2">
              Powered by the Guardian
            </a>
          </span>
          <span>•</span>
          <span>Imagery courtesy of NASA Earth Science / Landsat</span>
          <span>•</span>
          <span>Market data provided by Alpha Vantage</span>
        </div>
        <div class="text-neutral-400 text-center md:text-right">
          This dashboard is a preliminary research aid and does not constitute financial or investment advice.
        </div>
      </footer>

    </div>
  `;

  attachEventListeners();
}

// Event Listeners
function attachEventListeners() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input') as HTMLInputElement | null;

  if (form && input) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) {
        state.searchQuery = q;
        performCompanySearch(q);
      }
    };
  }

  // Pick list clicks
  const resultRows = document.querySelectorAll('.search-result-row');
  resultRows.forEach((row) => {
    (row as HTMLElement).onclick = () => {
      const sym = row.getAttribute('data-symbol');
      const found = state.searchMatches.find((m) => m.symbol === sym);
      if (found) {
        selectCompany(found);
      }
    };
  });

  // Quick pick buttons
  const quickPickBtns = document.querySelectorAll('.quick-pick-btn');
  quickPickBtns.forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      const sym = btn.getAttribute('data-quick-symbol');
      if (sym) {
        if (input) input.value = sym;
        state.searchQuery = sym;
        performCompanySearch(sym, true);
      }
    };
  });
}

// Perform Company Search via api/company.js
async function performCompanySearch(query: string, autoSelectFirst = false) {
  state.searchState = 'loading';
  state.searchMatches = [];
  render();

  try {
    const res = await fetch(`/api/company?q=${encodeURIComponent(query)}`);
    if (res.status === 429) {
      state.searchState = 'rate-limited';
      render();
      return;
    }
    if (res.status === 401 || res.status === 403 || res.status === 503) {
      state.searchState = 'refused';
      render();
      return;
    }
    if (!res.ok) {
      state.searchState = 'refused';
      render();
      return;
    }

    const data = await res.json();
    const matches: CompanyMatch[] = Array.isArray(data) ? data : data.matches || [];

    if (matches.length === 0) {
      state.searchState = 'empty';
      state.searchMatches = [];
    } else {
      state.searchState = 'idle';
      state.searchMatches = matches;
      if (autoSelectFirst && matches.length > 0) {
        selectCompany(matches[0]);
        return;
      }
    }
  } catch {
    state.searchState = 'refused';
  }
  render();
}

// Select a company and update all panels
function selectCompany(company: CompanyMatch) {
  state.selectedCompany = company;
  state.searchMatches = []; // Clear pick list once picked

  // Trigger Panel B (Satellite), Panel C (Price), Panel D (News)
  fetchSatellite(company);
  fetchPrices(company.symbol);
  fetchNews(company.name);

  render();
}

// Fetch Satellite Tile via api/satellite.js
async function fetchSatellite(company: CompanyMatch) {
  if (!company.facility || !company.facility.lat || !company.facility.lon) {
    state.satelliteState = 'no-facility';
    state.satelliteImageUrl = null;
    state.satelliteCaptureDate = null;
    render();
    return;
  }

  state.satelliteState = 'loading';
  state.satelliteImageUrl = null;
  state.satelliteCaptureDate = null;
  render();

  try {
    const lat = company.facility.lat;
    const lon = company.facility.lon;
    const res = await fetch(`/api/satellite?lat=${lat}&lon=${lon}`);

    if (res.status === 401 || res.status === 403) {
      state.satelliteState = 'refused';
      render();
      return;
    }

    if (res.status === 504 || res.status === 502 || res.status === 503) {
      state.satelliteState = 'unreachable';
      render();
      return;
    }

    if (res.status === 404) {
      const errJson = await res.json().catch(() => ({}));
      state.satelliteState = 'no-capture';
      state.satelliteNoCaptureDate = errJson.nearestDate || '2024-06-01';
      render();
      return;
    }

    if (!res.ok) {
      state.satelliteState = 'unreachable';
      render();
      return;
    }

    // Capture date from header
    const captureDate = res.headers.get('Capture-Date') || res.headers.get('X-Capture-Date') || '2024-06-01';
    state.satelliteCaptureDate = captureDate;

    // Get image blob and create object URL
    const blob = await res.blob();
    state.satelliteImageUrl = URL.createObjectURL(blob);
    state.satelliteState = 'loaded';
  } catch {
    state.satelliteState = 'unreachable';
  }
  render();
}

// Fetch 90-Day Prices via api/prices.js
async function fetchPrices(symbol: string) {
  state.priceState = 'loading';
  state.priceData = null;
  render();

  try {
    const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`);

    if (res.status === 401 || res.status === 403) {
      state.priceState = 'refused';
      render();
      return;
    }

    if (res.status === 429) {
      state.priceState = 'rate-limited';
      state.priceRateLimitedTime = new Date().toISOString();
      render();
      return;
    }

    if (res.status === 504 || res.status === 502 || res.status === 503) {
      state.priceState = 'unreachable';
      render();
      return;
    }

    if (!res.ok) {
      state.priceState = 'unreachable';
      render();
      return;
    }

    const data: PriceData = await res.json();

    if (!data.prices || data.prices.length === 0) {
      state.priceState = 'empty';
      state.priceData = null;
    } else {
      state.priceData = data;
      state.priceState = data.stale ? 'rate-limited' : 'loaded';
    }
  } catch {
    state.priceState = 'unreachable';
  }
  render();
}

// Fetch News via api/news.js
async function fetchNews(companyName: string) {
  state.newsState = 'loading';
  state.newsItems = [];
  render();

  try {
    const res = await fetch(`/api/news?q=${encodeURIComponent(companyName)}`);

    if (res.status === 401 || res.status === 403) {
      state.newsState = 'refused';
      render();
      return;
    }

    if (res.status === 504 || res.status === 502 || res.status === 503) {
      state.newsState = 'unreachable';
      render();
      return;
    }

    if (!res.ok) {
      state.newsState = 'unreachable';
      render();
      return;
    }

    const data = await res.json();
    const items: NewsItem[] = Array.isArray(data) ? data : data.results || [];

    if (items.length === 0) {
      state.newsState = 'empty';
      state.newsItems = [];
    } else {
      state.newsItems = items;
      state.newsState = 'loaded';
    }
  } catch {
    state.newsState = 'unreachable';
  }
  render();
}

// Fetch Health Status via api/health.js
async function fetchHealth() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data: HealthData = await res.json();
      state.health = data;
      render();
    }
  } catch {
    // Health is non-blocking
  }
}

// App Initialization
async function init() {
  render();
  // Fetch initial provider health status in background
  fetchHealth();

  // Load default demo company (WMT)
  selectCompany(DEFAULT_COMPANY);
}

// Start application
init();
