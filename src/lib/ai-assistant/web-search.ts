/**
 * Web search tool for AI Assistant.
 *
 * Uses Tavily Search API to find product recommendations, specs, and
 * purchasing suggestions when items are not found in the local stock DB.
 *
 * This is a READ-ONLY external lookup — never mutates the DB.
 */

export type WebSearchResult = {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    sourceDomain: string;
    score: number;
  }>;
  totalCount: number;
  summary: string;
};

const TAVILY_API_URL = "https://api.tavily.com/search";

function tavilyApiKey(): string {
  return (
    process.env.TAVILY_API_KEY ||
    process.env.SPARE_PART_TAVILY_KEY ||
    ""
  );
}

export function isWebSearchEnabled(): boolean {
  return tavilyApiKey().length > 0;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 50);
  }
}

export async function webSearchTool(input: {
  query?: string | null;
  maxResults?: number | null;
}): Promise<WebSearchResult> {
  const query = (input.query || "").trim();
  if (!query) {
    return { query: "", results: [], totalCount: 0, summary: "กรุณาระบุคำค้นหา" };
  }

  const apiKey = tavilyApiKey();
  if (!apiKey) {
    return {
      query,
      results: [],
      totalCount: 0,
      summary: "Web search ไม่ได้ตั้งค่า (ไม่มี TAVILY_API_KEY)",
    };
  }

  const maxResults = Math.min(input.maxResults || 5, 10);

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        query,
        results: [],
        totalCount: 0,
        summary: `Tavily error ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      answer?: string;
      results?: Array<{
        title: string;
        url: string;
        content: string;
        score?: number;
      }>;
    };

    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || "").slice(0, 300),
      sourceDomain: extractDomain(r.url),
      score: r.score || 0,
    }));

    const answer = data.answer
      ? String(data.answer).slice(0, 500)
      : `พบ ${results.length} ผลลัพธ์จากเว็บ`;

    return {
      query,
      results,
      totalCount: results.length,
      summary: answer,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      query,
      results: [],
      totalCount: 0,
      summary: `Web search ล้มเหลว: ${msg}`,
    };
  }
}
