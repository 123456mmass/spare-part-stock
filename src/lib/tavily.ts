/**
 * Tavily web search service for LINE AI Assistant.
 *
 * DB-first design: Tavily is ONLY called when the local database has no match.
 * Rate-limited, cached, with graceful fallback when TAVILY_API_KEY is missing.
 */

// ── Types ───────────────────────────────────────────────────────────

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  rawContent?: string;
};

export type WebPartSearchResult = {
  results: TavilySearchResult[];
  query: string;
  suggestedPartNumber?: string;
  suggestedBrand?: string;
};

export type WebPartSearchOptions = {
  partNumber?: string;
  brand?: string;
  category?: string;
  keywords?: string;
  maxResults?: number;
};

// ── Rate limiter (in-memory, per key) ───────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    throw new Error("ค้นเว็บถี่เกินไป กรุณาลองใหม่ใน 1 นาที");
  }

  entry.count++;
}

// ── Cache (in-memory, 5-min TTL) ─────────────────────────────────────

const searchCache = new Map<string, { result: WebPartSearchResult; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const CACHE_MAX_SIZE = 200;

function normalizeQuery(params: WebPartSearchOptions): string {
  return [params.partNumber || "", params.brand || "", params.category || "", params.keywords || ""]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .trim();
}

function cacheGet(normalized: string): WebPartSearchResult | null {
  const entry = searchCache.get(normalized);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    searchCache.delete(normalized);
    return null;
  }
  return entry.result;
}

function cacheSet(normalized: string, result: WebPartSearchResult): void {
  // Prune oldest if over capacity
  if (searchCache.size >= CACHE_MAX_SIZE) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
    if (oldest) searchCache.delete(oldest[0]);
  }
  searchCache.set(normalized, { result, cachedAt: Date.now() });
}

// ── Query builder ────────────────────────────────────────────────────

function buildSearchQuery(params: WebPartSearchOptions): string {
  const parts: string[] = [];

  // Part number with exact phrase for highest precision
  if (params.partNumber) {
    parts.push(`"${params.partNumber}"`);
  }

  // Brand + category for context
  if (params.brand) parts.push(params.brand);
  if (params.category) parts.push(params.category);

  // Additional keywords
  if (params.keywords) parts.push(params.keywords);

  // Source priority hints (appended at end to influence ranking)
  const sourceHints = [
    "datasheet",
    "specifications",
    "technical",
    "manual",
    "spare part",
    "industrial",
    "electrical",
  ].join(" OR ");

  // Only include source hints if we have something concrete to search
  if (parts.length > 0) {
    parts.push(`(${sourceHints})`);
  }

  return parts.join(" ");
}

// ── Main search function ─────────────────────────────────────────────

const TAVILY_API_URL = "https://api.tavily.com/search";

/**
 * Search for a part on the web using Tavily.
 * Throws if TAVILY_API_KEY is not configured or on API error.
 */
export async function searchPartOnWeb(
  params: WebPartSearchOptions,
  rateLimitKey?: string,
): Promise<WebPartSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Web search ยังไม่ได้เปิดใช้งาน (TAVILY_API_KEY ไม่ได้ตั้งค่า)");
  }

  const query = buildSearchQuery(params);
  if (!query.trim()) {
    throw new Error("ไม่มีข้อมูลเพียงพอสำหรับค้นเว็บ");
  }

  // Check cache
  const cacheKey = normalizeQuery(params);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Rate limit
  if (rateLimitKey) {
    checkRateLimit(rateLimitKey);
  }

  // Call Tavily
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const maxResults = params.maxResults ?? 5;
    const res = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "advanced",
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`Tavily API error: ${res.status} ${errorText.slice(0, 200)}`);
      throw new Error(`ค้นเว็บล้มเหลว (${res.status})`);
    }

    const data = await res.json();
    const results: TavilySearchResult[] = (data.results || []).map((r: Record<string, unknown>) => ({
      title: String(r.title || ""),
      url: String(r.url || ""),
      content: String(r.content || ""),
      score: typeof r.score === "number" ? r.score : 0,
      rawContent: r.raw_content ? String(r.raw_content) : undefined,
    }));

    const result: WebPartSearchResult = {
      results,
      query,
    };

    // Cache result
    cacheSet(cacheKey, result);

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ค้นเว็บใช้เวลานานเกินไป กรุณาลองใหม่");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Export for cache management (testing) ───────────────────────────

export function clearSearchCache(): void {
  searchCache.clear();
}

export function clearRateLimits(): void {
  rateLimitMap.clear();
}
