import fetch from "node-fetch";
import { load } from "cheerio";
import https from "node:https";
import { Playwright } from '@scrapeless-ai/sdk';

/**
 * ============================================================================
 * CONFIGURAÇÃO GERAL
 * ============================================================================
 */
const CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY_MS: 1200,
    MAX_DELAY_MS: 9000,
    STEP2_REPLAY_TIMES: 2,
    STEP2_REPLAY_WAIT_MIN: 350,
    STEP2_REPLAY_WAIT_MAX: 1100,
    CONCURRENCY: 2,

    // Rate Limiter
    RATE_LIMIT_INITIAL_INTERVAL: 800,  // ms entre requests
    RATE_LIMIT_INITIAL_BURST: 2,       // tokens iniciais
    RATE_LIMIT_MAX_INTERVAL: 5000,     // limite máximo de throttle
    RATE_LIMIT_JITTER: 400,            // variação aleatória
    RATE_LIMIT_BACKOFF_MULTIPLIER: 1.7,
    RATE_LIMIT_RECOVERY_AFTER: 25,     // requests ok para diminuir throttle

    // Session Cache
    SESSION_CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutos

    // Scrapeless SDK
    SCRAPELESS_API_KEY: process.env.SCRAPELESS_API_KEY || process.env.API_KEY,
};

/**
 * ============================================================================
 * HTTPS AGENT COM KEEP-ALIVE (requisito F)
 * ============================================================================
 */
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 10,
    maxFreeSockets: 5,
});

/**
 * ============================================================================
 * UTILS
 * ============================================================================
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

/**
 * ============================================================================
 * RATE LIMITER (requisito A) - Token Bucket com backoff adaptativo
 * ============================================================================
 */
class RateLimiter {
    constructor(host) {
        this.host = host;
        this.interval = CONFIG.RATE_LIMIT_INITIAL_INTERVAL;
        this.burstCapacity = CONFIG.RATE_LIMIT_INITIAL_BURST;
        this.tokens = this.burstCapacity;
        this.lastRefill = Date.now();
        this.queue = [];
        this.consecutiveSuccess = 0;
        this.isThrottling = false;
        this.stats = {
            total: 0,
            queued: 0,
            throttleIncreases: 0,
            throttleDecreases: 0,
        };
    }

    async acquire() {
        return new Promise((resolve) => {
            this.queue.push(resolve);
            this.processQueue();
        });
    }

    processQueue() {
        if (this.queue.length === 0) return;

        const now = Date.now();
        const elapsed = now - this.lastRefill;

        // Refill tokens baseado no tempo
        if (elapsed >= this.interval) {
            const tokensToAdd = Math.floor(elapsed / this.interval);
            this.tokens = Math.min(this.burstCapacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }

        // Processar fila se temos tokens
        if (this.tokens > 0 && this.queue.length > 0) {
            this.tokens--;
            this.stats.total++;
            const resolve = this.queue.shift();
            resolve();

            // Continue processando se ainda há tokens e fila
            if (this.tokens > 0 && this.queue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        } else if (this.queue.length > 0) {
            // Agendar próximo processamento
            const waitTime = this.interval - elapsed + rand(0, CONFIG.RATE_LIMIT_JITTER);
            setTimeout(() => this.processQueue(), Math.max(0, waitTime));
        }
    }

    recordSuccess() {
        this.consecutiveSuccess++;

        // Diminuir throttle gradualmente após período sem 429
        if (this.consecutiveSuccess >= CONFIG.RATE_LIMIT_RECOVERY_AFTER && this.isThrottling) {
            const oldInterval = this.interval;
            this.interval = Math.max(
                CONFIG.RATE_LIMIT_INITIAL_INTERVAL,
                this.interval * 0.85
            );

            if (this.interval < oldInterval) {
                this.burstCapacity = Math.min(
                    CONFIG.RATE_LIMIT_INITIAL_BURST,
                    this.burstCapacity + 1
                );
                this.stats.throttleDecreases++;
            }

            if (this.interval <= CONFIG.RATE_LIMIT_INITIAL_INTERVAL) {
                this.isThrottling = false;
            }

            this.consecutiveSuccess = 0;
        }
    }

    record429() {
        this.consecutiveSuccess = 0;
        this.isThrottling = true;

        const oldInterval = this.interval;
        const oldBurst = this.burstCapacity;

        // Aumentar intervalo exponencialmente
        this.interval = Math.min(
            CONFIG.RATE_LIMIT_MAX_INTERVAL,
            Math.floor(this.interval * CONFIG.RATE_LIMIT_BACKOFF_MULTIPLIER)
        );

        // Reduzir burst temporariamente
        this.burstCapacity = Math.max(1, this.burstCapacity - 1);
        this.tokens = Math.min(this.tokens, this.burstCapacity);

        this.stats.throttleIncreases++;
    }

    getStats() {
        return {
            ...this.stats,
            currentInterval: this.interval,
            currentBurst: this.burstCapacity,
            queueSize: this.queue.length,
            isThrottling: this.isThrottling,
        };
    }
}

// Global rate limiters por host
const rateLimiters = new Map();

function getRateLimiter(url) {
    const hostname = new URL(url).hostname;
    if (!rateLimiters.has(hostname)) {
        rateLimiters.set(hostname, new RateLimiter(hostname));
    }
    return rateLimiters.get(hostname);
}

/**
 * ============================================================================
 * SESSION CACHE (requisito E) - Cache com TTL
 * ============================================================================
 */
class SessionCache {
    constructor() {
        this.cache = new Map();
        this.stats = { hits: 0, misses: 0, invalidations: 0 };
    }

    getKey(itemId, productId) {
        return `${itemId}|${productId}`;
    }

    set(itemId, productId, sessionId, cookieJar) {
        const key = this.getKey(itemId, productId);
        this.cache.set(key, {
            sessionId,
            cookieString: cookieJar.getCookieString(),
            timestamp: Date.now(),
        });
    }

    get(itemId, productId) {
        const key = this.getKey(itemId, productId);
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Verificar TTL
        const age = Date.now() - entry.timestamp;
        if (age > CONFIG.SESSION_CACHE_TTL_MS) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry;
    }

    invalidate(itemId, productId) {
        const key = this.getKey(itemId, productId);
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.invalidations++;
        }
        return deleted;
    }

    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: this.stats.hits + this.stats.misses > 0
                ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1) + '%'
                : '0%'
        };
    }
}

const sessionCache = new SessionCache();

/**
 * ============================================================================
 * COOKIE JAR
 * ============================================================================
 */
class CookieJar {
    constructor(initialCookieString = "") {
        this.cookies = new Map();
        this.parseCookieString(initialCookieString);
    }

    parseCookieString(str) {
        if (!str) return;
        str.split(";").forEach((pair) => {
            const parts = pair.split("=");
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const value = parts.slice(1).join("=").trim();
                if (name) this.cookies.set(name, value);
            }
        });
    }

    updateFromResponse(headers) {
        const raw = headers?.raw ? headers.raw() : {};
        const setCookies = raw["set-cookie"] || [];
        for (const sc of setCookies) {
            const firstPart = sc.split(";")[0];
            const eq = firstPart.indexOf("=");
            if (eq === -1) continue;
            const name = firstPart.slice(0, eq).trim();
            const value = firstPart.slice(eq + 1).trim();
            if (name) this.cookies.set(name, value);
        }
    }

    getCookieString() {
        const parts = [];
        for (const [name, val] of this.cookies.entries()) {
            parts.push(`${name}=${val}`);
        }
        return parts.join("; ");
    }

    size() {
        return this.cookies.size;
    }
}

/**
 * ============================================================================
 * HEADERS BUILDER (requisito F)
 * ============================================================================
 */
function buildHeaders(cookieJar, options = {}) {
    const { referer, accept } = options;

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
            accept ||
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Site": "same-origin",
    };

    if (referer) headers["Referer"] = referer;
    const cookieStr = cookieJar.getCookieString();
    if (cookieStr) headers["Cookie"] = cookieStr;

    return headers;
}

/**
 * ============================================================================
 * FETCH WITH RETRY (requisito B) - Integrado com Rate Limiter
 * ============================================================================
 */
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES, context = "") {
    const limiter = getRateLimiter(url);
    let attempt = 0;
    let lastErr = null;

    while (attempt <= retries) {
        try {
            // AGUARDAR TOKEN DO RATE LIMITER
            await limiter.acquire();

            // Fazer request com https agent
            const res = await fetch(url, {
                ...options,
                agent: httpsAgent,
            });

            // === TRATAMENTO DIFERENCIADO POR STATUS ===

            // 429: backoff forte + aumenta throttle global
            if (res.status === 429) {
                limiter.record429();

                const retryAfter = res.headers.get("Retry-After");
                let waitMs = Math.min(
                    CONFIG.BASE_DELAY_MS * Math.pow(2.5, attempt),
                    CONFIG.MAX_DELAY_MS
                );

                if (retryAfter) {
                    const sec = Number.parseInt(retryAfter, 10);
                    if (!Number.isNaN(sec)) waitMs = Math.min(sec * 1000, CONFIG.MAX_DELAY_MS);
                }

                waitMs += rand(200, 1000);

                try { await res.text(); } catch { }
                await sleep(waitMs);
                attempt++;
                continue;
            }

            // 5xx: backoff moderado (não afeta rate limiter global)
            if (res.status >= 500) {
                let waitMs = Math.min(
                    CONFIG.BASE_DELAY_MS * Math.pow(1.8, attempt),
                    CONFIG.MAX_DELAY_MS
                );
                waitMs += rand(150, 600);

                try { await res.text(); } catch { }
                await sleep(waitMs);
                attempt++;
                continue;
            }

            // 403/401: falha rápida (não insistir)
            if (res.status === 403 || res.status === 401) {
                try { await res.text(); } catch { }
                return res; // retorna sem retry
            }

            // Success: registrar no limiter
            if (res.ok) {
                limiter.recordSuccess();
            }

            return res;

        } catch (err) {
            lastErr = err;
            attempt++;
            if (attempt > retries) break;

            const waitMs = 400 * attempt + rand(100, 400);
            await sleep(waitMs);
        }
    }

    throw lastErr || new Error(`fetchWithRetry failed after ${retries} retries`);
}

/**
 * ============================================================================
 * EXTRAÇÃO DE JSON COM CHAVES BALANCEADAS
 * ============================================================================
 */
function sliceBalancedBraces(text, startIndex) {
    let depth = 0;
    let inString = false;
    let result = "";

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        if (char === '"' && text[i - 1] !== "\\") inString = !inString;

        if (!inString) {
            if (char === "{") depth++;
            if (char === "}") depth--;
        }

        result += char;
        if (depth === 0 && result.length > 0) return result;
    }
    throw new Error("JSON object not closed properly");
}

/**
 * ============================================================================
 * SESSION ID EXTRACTION
 * ============================================================================
 */
const SESSION_REGEX_ABS =
    /https?:\/\/www\.mercadolivre\.com\.br\/publicar\/bomni\/([a-zA-Z0-9_-]+)\/item_data_form/i;
const SESSION_REGEX_REL =
    /\/publicar\/bomni\/([a-zA-Z0-9_-]+)\/item_data_form/i;

function extractSessionFromLocation(location) {
    if (!location) return null;
    const m = location.match(/\/publicar\/bomni\/([a-zA-Z0-9_-]+)\/item_data_form/i);
    return m?.[1] || null;
}

function bruteForceSessionId(html) {
    if (!html) return null;

    // A: absoluto
    let m = html.match(SESSION_REGEX_ABS);
    if (m?.[1]) return { sessionId: m[1], strategy: "A(abs-url)" };

    // B: relativo
    m = html.match(SESSION_REGEX_REL);
    if (m?.[1]) return { sessionId: m[1], strategy: "B(rel-url)" };

    // Meta refresh
    const metaRefresh = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i);
    if (metaRefresh?.[1]) {
        const url = metaRefresh[1];
        const mm = url.match(SESSION_REGEX_REL) || url.match(SESSION_REGEX_ABS);
        if (mm?.[1]) return { sessionId: mm[1], strategy: "META(refresh)" };
    }

    // C: __PRELOADED_STATE__
    if (html.includes("window.__PRELOADED_STATE__")) {
        try {
            const marker = "window.__PRELOADED_STATE__";
            const start = html.indexOf(marker);
            const braceStart = html.indexOf("{", start);
            if (braceStart !== -1) {
                const jsonStr = sliceBalancedBraces(html, braceStart);
                let mm = jsonStr.match(SESSION_REGEX_REL) || jsonStr.match(SESSION_REGEX_ABS);
                if (mm?.[1]) return { sessionId: mm[1], strategy: "C(preloaded-regex)" };
            }
        } catch { }
    }

    // D: Cheerio
    try {
        const $ = load(html);

        let found = null;
        $("a, link, form").each((_, el) => {
            const href = $(el).attr("href") || $(el).attr("action");
            if (!href) return;
            const mm = href.match(SESSION_REGEX_REL) || href.match(SESSION_REGEX_ABS);
            if (mm?.[1]) {
                found = mm[1];
                return false;
            }
        });
        if (found) return { sessionId: found, strategy: "D(dom-href/action)" };

        let scriptFound = null;
        $("script").each((_, el) => {
            const txt = $(el).html() || "";
            if (!txt.includes("item_data_form")) return;
            const mm = txt.match(SESSION_REGEX_REL) || txt.match(SESSION_REGEX_ABS);
            if (mm?.[1]) {
                scriptFound = mm[1];
                return false;
            }
        });
        if (scriptFound) return { sessionId: scriptFound, strategy: "D(script)" };
    } catch { }

    return null;
}

/**
 * ============================================================================
 * STEP2: Extração de Session com replay inteligente
 * ============================================================================
 */
async function runStep2AndExtractSession({ url2, jar, referer, itemId }) {
    for (let attempt = 0; attempt <= CONFIG.STEP2_REPLAY_TIMES; attempt++) {
        const res2 = await fetchWithRetry(
            url2,
            {
                headers: buildHeaders(jar, { referer }),
                redirect: "manual",
            },
            CONFIG.MAX_RETRIES,
            `Step2[${itemId}]`
        );

        jar.updateFromResponse(res2.headers);

        const location = res2.headers.get("location");
        if (location) {
            const sessionId = extractSessionFromLocation(location);
            if (sessionId) {
                return { sessionId, step2Status: res2.status, strategy: "Location(302)" };
            }
        }

        if (res2.status !== 200) {
            throw new Error(`[SalesEstimator] Step2 status ${res2.status} sem Location (item ${itemId})`);
        }

        // 200 HTML: tenta extrair
        const html = await res2.text();
        const bf = bruteForceSessionId(html);
        if (bf?.sessionId) {
            return { sessionId: bf.sessionId, step2Status: 200, strategy: `HTML:${bf.strategy}` };
        }

        if (attempt < CONFIG.STEP2_REPLAY_TIMES) {
            await sleep(rand(CONFIG.STEP2_REPLAY_WAIT_MIN, CONFIG.STEP2_REPLAY_WAIT_MAX));
            continue;
        }

        throw new Error("[SalesEstimator] Não foi possível obter Session ID no Step 2 (200 HTML).");
    }

    throw new Error("[SalesEstimator] Step2 flow inesperado.");
}

/**
 * ============================================================================
 * PROBE (requisito C): HEAD primeiro, fallback para GET
 * ============================================================================
 */
async function probeSession({ sessionId, jar, referer }) {
    const probeUrl = `https://www.mercadolivre.com.br/publicar/bomni/${sessionId}/item_data_form`;

    // Tentar HEAD primeiro (mais leve)
    try {
        const resHead = await fetchWithRetry(
            probeUrl,
            {
                method: "HEAD",
                headers: buildHeaders(jar, { referer }),
                redirect: "manual",
            },
            2, // menos retries no HEAD
            `Probe-HEAD[${sessionId.slice(0, 8)}]`
        );

        jar.updateFromResponse(resHead.headers);

        // HEAD 429: re-enfileirar com delay
        if (resHead.status === 429) {
            await sleep(rand(1500, 3000));
        } else if (resHead.status === 404 || resHead.status === 403) {
            throw new Error(`Session inválida no probe (HEAD ${resHead.status})`);
        } else if (resHead.status === 200 || resHead.status === 302) {
            // HEAD sucesso
            return probeUrl;
        }
    } catch (err) {
        // HEAD failed, fallback to GET
    }

    // Fallback: GET completo
    const resGet = await fetchWithRetry(
        probeUrl,
        {
            method: "GET",
            headers: buildHeaders(jar, { referer }),
            redirect: "manual",
        },
        CONFIG.MAX_RETRIES,
        `Probe-GET[${sessionId.slice(0, 8)}]`
    );

    jar.updateFromResponse(resGet.headers);

    if (resGet.status === 404 || resGet.status === 403) {
        throw new Error(`Session inválida no probe (GET ${resGet.status})`);
    }

    // Consumir body para estabilizar
    if (resGet.status === 200) {
        try { await resGet.text(); } catch { }
    }

    return probeUrl;
}

/**
 * ============================================================================
 * FLUXO PRINCIPAL: getSessionIdAndCookies com cache
 * ============================================================================
 */
async function getSessionIdAndCookies({ itemId, productId, cookieHeader }) {
    // Tentar cache primeiro
    const cached = sessionCache.get(itemId, productId);
    if (cached) {
        const jar = new CookieJar(cached.cookieString);
        return { sessionId: cached.sessionId, jar, fromCache: true };
    }

    const jar = new CookieJar(cookieHeader);

    // STEP 1
    const url1 = `https://www.mercadolivre.com.br/syi/core/list/equals?itemId=${itemId}&productId=${productId}`;
    const res1 = await fetchWithRetry(
        url1,
        {
            headers: buildHeaders(jar, { referer: "https://www.mercadolivre.com.br/" }),
            redirect: "manual",
        },
        CONFIG.MAX_RETRIES,
        `Step1[${itemId}]`
    );

    jar.updateFromResponse(res1.headers);

    let nextUrl = res1.headers.get("location");
    if (nextUrl && nextUrl.startsWith("/")) {
        nextUrl = `https://www.mercadolivre.com.br${nextUrl}`;
    }

    if (!nextUrl) {
        const body = await res1.text().catch(() => "");
        const bf = bruteForceSessionId(body);
        if (bf?.sessionId) {
            sessionCache.set(itemId, productId, bf.sessionId, jar);
            return { sessionId: bf.sessionId, jar };
        }
        throw new Error(`Falha no Step 1: status=${res1.status} sem Location`);
    }

    // STEP 2
    const step2 = await runStep2AndExtractSession({
        url2: nextUrl,
        jar,
        referer: url1,
        itemId,
    });

    // Salvar no cache
    sessionCache.set(itemId, productId, step2.sessionId, jar);

    return { sessionId: step2.sessionId, jar, step2Meta: step2 };
}

/**
 * ============================================================================
 * BUSCA DADOS DE VENDAS (com cache e tratamento de 429)
 * ============================================================================
 */

/**
 * ============================================================================
 * SCRAPELESS SDK INTEGRATION
 * ============================================================================
 */
async function getSalesEstimateWithScrapeless({ itemId, productId }) {
    let browser = null;
    try {
        browser = await Playwright.connect({
            apiKey: CONFIG.SCRAPELESS_API_KEY,
            proxyCountry: "US", // Tentando apenas país
            sessionName: `sales_${itemId}`,
            sessionRecording: false,
            sessionTTL: 300,
        });

        const context = await browser.newContext();
        const page = await context.newPage();

        // Step 1: Ir para a URL "equals" que redireciona
        const url1 = `https://www.mercadolivre.com.br/syi/core/list/equals?itemId=${itemId}&productId=${productId}`;

        await page.goto(url1, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Esperar estabilizar URL
        await page.waitForTimeout(2000);

        const currentUrl = page.url();

        let sessionId = extractSessionFromLocation(currentUrl);

        if (!sessionId) {
            // Tenta extrair do HTML se não estiver na URL
            const html = await page.content();
            const bf = bruteForceSessionId(html);
            if (bf?.sessionId) {
                sessionId = bf.sessionId;
            }
        }

        if (!sessionId) {
            throw new Error("[Scrapeless] Não foi possível obter Session ID após navegação inicial.");
        }

        // Step 2: Ir para o formulário de vendas
        const targetUrl = `https://www.mercadolivre.com.br/anuncie/bomni/${sessionId}/sales_condition_form`;

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Tentar esperar pelo conteúdo ou pelo __PRELOADED_STATE__
        try {
            await page.waitForSelector('body', { timeout: 10000 });
        } catch (e) { }

        const html = await page.content();

        // Usar a lógica existente de parsing
        const state = extractPreloadedState(html);
        const rowData = findAutomationRowData(state);

        if (!rowData || rowData.length === 0) {
            return {
                source: "SCRAPELESS_FORM_FAILED",
                reason: "ROW_DATA_NOT_FOUND",
                sessionId,
                totalLowerBound: 0,
            };
        }

        const metrics = parseAndSumSales(rowData);

        return {
            source: "SCRAPELESS_SDK",
            sessionId,
            ...metrics,
        };

    } catch (err) {
        console.error(`[Scrapeless] Erro: ${err.message}`);
        throw err;
    } finally {
        if (browser) {
            await browser.close().catch(() => { });
        }
    }
}

export async function getSalesEstimate({ itemId, productId, cookieHeader }) {
    // Se tiver API KEY, usa o Scrapeless
    if (CONFIG.SCRAPELESS_API_KEY) {
        try {
            return await getSalesEstimateWithScrapeless({ itemId, productId });
        } catch (err) {
            console.error(`[SalesEstimator] Fallback Scrapeless falhou, tentando método legado: ${err.message}`);
            // Fallback para o método legado se falhar? 
            // Ou retornamos o erro? O usuário pediu para "implementar e utilizar".
            // Vou manter fallback por segurança se for erro de conexão, mas ideal é usar o SDK.
        }
    }

    try {
        // 1) Sessão (com cache)
        const { sessionId, jar, step2Meta, fromCache } = await getSessionIdAndCookies({
            itemId,
            productId,
            cookieHeader,
        });

        // 2) Probe
        const refererIgual = `https://www.mercadolivre.com.br/publicar/bomni/igual/${itemId}?productId=${productId}`;

        let probeUrl;
        try {
            probeUrl = await probeSession({ sessionId, jar, referer: refererIgual });
        } catch (probeErr) {
            // Se probe falhar e era cache, invalidar e tentar de novo
            if (fromCache) {
                sessionCache.invalidate(itemId, productId);

                const retry = await getSessionIdAndCookies({ itemId, productId, cookieHeader });
                probeUrl = await probeSession({
                    sessionId: retry.sessionId,
                    jar: retry.jar,
                    referer: refererIgual,
                });
            } else {
                throw probeErr;
            }
        }

        // 3) sales_condition_form (com retry de 429)
        const targetUrl = `https://www.mercadolivre.com.br/anuncie/bomni/${sessionId}/sales_condition_form`;
        const resForm = await fetchWithRetry(
            targetUrl,
            {
                headers: buildHeaders(jar, { referer: probeUrl }),
                redirect: "manual",
            },
            CONFIG.MAX_RETRIES,
            `Form[${itemId}]`
        );

        jar.updateFromResponse(resForm.headers);

        if (!resForm.ok) {
            throw new Error(`Sales Form error: ${resForm.status}`);
        }

        const html = await resForm.text();

        // 4) __PRELOADED_STATE__
        const state = extractPreloadedState(html);

        // 5) rowData
        const rowData = findAutomationRowData(state);
        if (!rowData || rowData.length === 0) {
            return {
                source: "FORM_FAILED",
                reason: "ROW_DATA_NOT_FOUND",
                sessionId,
                step2Strategy: step2Meta?.strategy,
                totalLowerBound: 0,
            };
        }

        // 6) parse vendas
        const metrics = parseAndSumSales(rowData);

        return {
            source: "FORM_PRIMARY",
            sessionId,
            fromCache: !!fromCache,
            step2Strategy: step2Meta?.strategy,
            step2Status: step2Meta?.step2Status,
            ...metrics,
            debug: {
                rateLimiter: getRateLimiter(targetUrl).getStats(),
                sessionCache: sessionCache.getStats(),
            },
        };
    } catch (err) {
        console.error(`[SalesEstimator] Falha para ${itemId}: ${err.message}`);
        return {
            source: "SALES_ESTIMATOR_ERROR",
            error: err.message,
            totalLowerBound: 0,
            debug: {
                rateLimiters: Array.from(rateLimiters.entries()).map(([host, rl]) => ({
                    host,
                    ...rl.getStats(),
                })),
                sessionCache: sessionCache.getStats(),
            },
        };
    }
}

/**
 * ============================================================================
 * HELPERS DE EXTRAÇÃO (mantidos/refinados)
 * ============================================================================
 */
function extractPreloadedState(html) {
    const marker = "window.__PRELOADED_STATE__ =";
    const idx = html.indexOf(marker);
    if (idx === -1) throw new Error("__PRELOADED_STATE__ marker not found");

    try {
        const startBrace = html.indexOf("{", idx);
        if (startBrace === -1) throw new Error("Start brace missing");
        const jsonStr = sliceBalancedBraces(html, startBrace);
        return JSON.parse(jsonStr);
    } catch (e) {
        throw new Error(`JSON Parse Error: ${e.message}`);
    }
}

function findAutomationRowData(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Caminhos comuns no ML
    if (obj.automationTable && Array.isArray(obj.automationTable.rowData)) return obj.automationTable.rowData;
    if (obj.modal?.content?.automationTable?.rowData) return obj.modal.content.automationTable.rowData;

    // Deep search
    for (const key of Object.keys(obj)) {
        const val = obj[key];

        if (Array.isArray(val) && val.length > 0) {
            // Heurística: tenta detectar arrays que parecem rowData
            const sample = JSON.stringify(val[0]).toLowerCase();
            if (sample.includes("venda") || sample.includes("vendido")) return val;
        }

        const res = findAutomationRowData(val);
        if (res) return res;
    }

    return null;
}

function parseAndSumSales(rowData) {
    let totalLowerBound = 0;
    let hasLowerBound = false;
    let rowsParsed = 0;
    const rawExamples = [];

    for (const row of rowData) {
        const str = JSON.stringify(row);

        // Captura: "+100 vendas", "500 vendidos", "1.000 vendas"
        const match = str.match(/"(\+?)([\d\.]+)\s+(vendas?|vendidos?)"/i);
        if (match) {
            rowsParsed++;
            const cleanStr = match[0].replace(/"/g, "");
            if (rawExamples.length < 5) rawExamples.push(cleanStr);

            if (match[1] === "+") hasLowerBound = true;

            const num = parseInt(match[2].replace(/\./g, ""), 10);
            if (!isNaN(num)) totalLowerBound += num;
        }
    }

    return { totalLowerBound, hasLowerBound, rowsParsed, rawExamples };
}

/**
 * ============================================================================
 * CONCURRENCY HELPER (requisito D) - versão corrigida (sem bug de push duplo)
 * ============================================================================
 */
export async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let idx = 0;

    async function worker(workerId) {
        while (true) {
            const current = idx++;
            if (current >= items.length) break;

            try {
                results[current] = await fn(items[current], current, workerId);
            } catch (e) {
                results[current] = {
                    error: true,
                    message: e.message || String(e),
                    item: items[current],
                };
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.max(1, limit); i++) {
        workers.push(worker(i + 1));
    }

    await Promise.all(workers);
    return results;
}

