# Script References — consultaEmMassaTTSComAtributosAdicionais

## Visão Geral do Projeto

**Origenow Analytics** — Plataforma de inteligência competitiva para Mercado Livre (MLB).  
Realiza buscas em massa de produtos, calcula TTS (Time-to-Sell), detecta fulfillment, estima velocidade de vendas e exibe dashboards interativos com KPIs.

Stack: **Node.js/Express** (backend) + **React 19 + Vite** (frontend)  
Porta padrão: `3000`

---

## Árvore de Arquivos

```
consultaEmMassaTTSComAtributosAdicionais/
├── .env                          # Credenciais: OAuth ML, cookie SID, proxy Webshare, CEP
├── package.json                  # Dependências backend (Express, cheerio, dotenv, node-fetch...)
│
├── src/                          # Backend Node.js
│   ├── server.js                 # Servidor Express, rotas, inicialização
│   ├── config/
│   │   └── index.js              # Carregador de variáveis de ambiente
│   ├── services/
│   │   ├── mercadolivre/
│   │   │   ├── auth.js           # OAuth 2.0 + extração de CSRF/cookies
│   │   │   ├── scraper.js        # Busca e extração de detalhes de itens (602 linhas)
│   │   │   ├── client.js         # Chamadas batch: vendedor, frete, taxas
│   │   │   └── sales_estimator.js# Scraping avançado com rate limiting e cache (1000+ linhas)
│   │   └── proxy/
│   │       ├── provider.js       # Integração API Webshare (até 2000 proxies)
│   │       └── iterator.js       # Rotação aleatória com throttle por proxy (30s)
│   └── utils/
│       └── calculations.js       # Cálculo de TTS e velocidade de vendas
│
└── client/                       # Frontend React
    ├── package.json              # React 19, Tailwind v4, Chart.js, GSAP, xlsx-js-style
    ├── vite.config.js            # Configuração do build Vite
    ├── tailwind.config.js        # Configuração Tailwind CSS
    ├── index.html                # HTML de entrada
    └── src/
        ├── main.jsx              # Ponto de montagem da app React
        ├── App.jsx               # Componente raiz (~36KB); roteamento e estado global
        ├── index.css             # Estilos globais
        ├── config.js             # URL base da API (frontend)
        └── components/
            ├── LoginPage.jsx         # UI de autenticação
            ├── HomeOnboarding.jsx    # Tela de boas-vindas / setup inicial
            ├── CookieUpdaterModal.jsx# Modal para atualizar cookie SSID
            ├── CustomLoader.jsx      # Animação de carregamento
            ├── TermKPIs.jsx          # Dashboard de KPIs por termo de busca
            ├── MarketAnalysis.jsx    # Visualizações de análise de mercado (Chart.js)
            ├── LocationHeatmap.jsx   # Heatmap geográfico (Brasil)
            ├── MagicBento.jsx        # Layout bento-box
            └── BrazilMapData.js      # Dados geográficos por estado (heatmap)
```

---

## Rotas da API (src/server.js)

| Método | Rota                  | Função                                               |
|--------|-----------------------|------------------------------------------------------|
| POST   | `/api/search`         | Recebe `{ query }`, retorna produtos ordenados por TTS |
| POST   | `/api/settings/ssid`  | Atualiza cookie de sessão (memória + .env)           |
| GET    | `/*`                  | Fallback SPA → serve `client/dist/index.html`        |

---

## Funções e Classes Principais

### Backend — Scraper (`src/services/mercadolivre/scraper.js`)

| Função | Linha aprox. | Descrição |
|--------|-------------|-----------|
| `findAttribute(data, ids, labels)` | ~1 | Busca recursiva de atributo em produto |
| `searchProducts(query, proxyIterator, accessToken)` | ~275 | Orquestrador principal; busca 1000+ resultados, calcula TTS |
| `ifTraditional(itemID, xsrf, csrf, d2id, proxyIterator, catalogID)` | ~350 | Detalha item individual; extrai vendas, frete, specs |
| `ifCatalog(catalogID, xsrf, csrf, d2id, proxyIterator)` | ~480 | Agrega ofertas de catálogo (múltiplos vendedores) |

### Backend — Client (`src/services/mercadolivre/client.js`)

| Função | Descrição |
|--------|-----------|
| `getseller(accessToken, sellerIds)` | Batch de reputação e localização de vendedores |
| `simulateshippingCost(accessToken, items, batchSize)` | Simula frete via API ML |
| `fetchSaleFees(accessToken, items)` | Calcula taxas de anúncio por item |

### Backend — Sales Estimator (`src/services/mercadolivre/sales_estimator.js`)

| Classe/Função | Descrição |
|---------------|-----------|
| `RateLimiter` | Token bucket; backoff adaptativo (1.7× em falhas, 2.5× em 429) |
| `SessionCache` | Cache em memória com TTL de 10 min; rastreia hit rate |
| `CookieJar` | Parse de `Set-Cookie`; gerencia ciclo de vida dos cookies |
| `getSessionIdAndCookies()` | Extração de sessão em 3 passos (fetch → redirect → ID) |
| `getSalesEstimateWithScrapeless()` | Automação de browser via Scrapeless SDK (Playwright) |
| `parseAndSumSales(html)` | Regex: extrai "100+ vendas", "1.000 vendidos" etc. |

### Backend — Auth (`src/services/mercadolivre/auth.js`)

| Função | Descrição |
|--------|-----------|
| `getAccessToken()` | OAuth 2.0 client credentials; refresh a cada 20 min |
| `getAuthHeaders(proxyIterator)` | Extrai CSRF token, d2id e XSRF token via scraping |

### Backend — Proxy (`src/services/proxy/`)

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `getProxyList(token)` | `provider.js:3` | Busca lista de até 2000 proxies na API Webshare |
| `createRandomIterator(array, interval)` | `iterator.js:1` | Rotação aleatória; throttle de 30s por proxy |

### Backend — Cálculos (`src/utils/calculations.js`)

| Função | Descrição |
|--------|-----------|
| `calcularMediaVendasPorDia(dataISO, valorInteiro)` | TTS = dias_desde_anúncio / qtd_vendas; retorna velocity e projeções |

---

## Fluxo de Dados

```
[Frontend] POST /api/search { query }
     ↓
[server.js] Inicializa sessão e proxies
     ↓
[auth.js] getAccessToken() + getAuthHeaders()  →  OAuth token + CSRF/cookies
     ↓
[scraper.js] searchProducts()  →  Busca 1000+ itens no ML
     ↓  Para cada item:
     ├── ifTraditional() ou ifCatalog()  →  Detalhes, qtd vendas, preço
     ├── [client.js] getseller()         →  Reputação + localização
     ├── [client.js] simulateshippingCost() →  Custo de frete
     └── [client.js] fetchSaleFees()     →  Taxa do marketplace
     ↓
[calculations.js] calcularMediaVendasPorDia()  →  TTS, velocity, projeções
     ↓
[server.js] Retorna array JSON ordenado por TTS (menor = mais rápido)
```

---

## Formato de Resposta da Busca

```json
{
  "termo_pesquisa": "notebook samsung",
  "id": "MLB2345678901",
  "product_id": "MLB1234567890",
  "title": "Samsung Galaxy Book...",
  "itemPrice": 2499.99,
  "sales_quantity": 45,
  "tts": 2.67,
  "velocity": 0.4,
  "sales_per_month": 12.0,
  "seller_id": 123456789,
  "seller_nickname": "techstore_br",
  "reputation_level": 5,
  "power_seller": true,
  "free_shipping": true,
  "logistic_type": "fulfillment",
  "is_fulfillment": true,
  "shipping_cost": 0,
  "sale_fee": 249.99,
  "brand": "Samsung",
  "part_number": "NP900X5L",
  "thumbnail": "https://...",
  "startTime": "2024-01-15T10:30:00Z"
}
```

---

## APIs Externas Consumidas

| Serviço | Endpoint | Finalidade |
|---------|----------|------------|
| ML OAuth | `https://api.mercadolibre.com/oauth/token` | Token de acesso |
| ML Search | `https://www.mercadolivre.com.br/api/search/client` | Busca de produtos (1000+) |
| ML Product | `https://produto.mercadolivre.com.br/p/api/items` | Detalhes + vendas |
| ML Catalog | `https://www.mercadolivre.com.br/p/api/products/{id}/s` | Ofertas de catálogo |
| ML Seller | `https://api.mercadolibre.com/users/{id}` | Reputação do vendedor |
| ML Shipping | `https://api.mercadolibre.com/cart/shipping` | Simulação de frete |
| ML Pricing | `https://api.mercadolibre.com/sites/MLB/listing_prices` | Taxas de anúncio |
| Webshare | `https://proxy.webshare.io/api/v2/proxy/list` | Lista de proxies |
| Scrapeless | Browser automation service | Extração de sessão/vendas |

---

## Configuração (.env)

| Variável | Uso |
|----------|-----|
| `MELI_CLIENT_ID` | OAuth Client ID do Mercado Livre |
| `MELI_CLIENT_SECRET` | OAuth Client Secret |
| `SID_COOKIE` | Cookie de sessão para scraping (`ghy-...`) |
| `PORT` | Porta do servidor Express (padrão: 3000) |
| `USE_PROXY` | Ativa rotação de proxies (`true`/`false`) |
| `WEBSHARE_TOKEN` | Token da API Webshare |
| `CEP` | CEP destino para simulação de frete (ex: `36900040`) |

---

## Estratégia de Rate Limiting e Cache

- **RateLimiter por host**: throttle separado por domínio
- **Token bucket**: inicial 800ms, máximo 5000ms, burst de 2
- **Backoff adaptativo**: ×1.7 em falhas, ×1.8 em 5xx, ×2.5 em 429
- **SessionCache**: TTL de 10 min por combinação `item+product`
- **CookieJar**: mantém cookies HTTP entre requisições
- **Proxy rotation**: throttle de 30s por proxy (evita bloqueio de IP)
- **Fallbacks**: `shipping_cost = 999`, `tts = 999` em caso de erro

---

## Componentes Frontend (client/src/)

| Componente | Arquivo | Responsabilidade |
|------------|---------|-----------------|
| `App` | `App.jsx` | Shell principal; roteamento e estado global (~36KB) |
| `LoginPage` | `components/LoginPage.jsx` | Interface de autenticação |
| `HomeOnboarding` | `components/HomeOnboarding.jsx` | Fluxo de setup inicial |
| `CookieUpdaterModal` | `components/CookieUpdaterModal.jsx` | Atualização do cookie SSID |
| `CustomLoader` | `components/CustomLoader.jsx` | Animação de loading |
| `TermKPIs` | `components/TermKPIs.jsx` | KPIs por termo (TTS, velocity, vendas) |
| `MarketAnalysis` | `components/MarketAnalysis.jsx` | Gráficos de tendência (Chart.js) |
| `LocationHeatmap` | `components/LocationHeatmap.jsx` | Heatmap por estado brasileiro |
| `MagicBento` | `components/MagicBento.jsx` | Layout bento-box |
| `BrazilMapData` | `components/BrazilMapData.js` | Dados geográficos por estado |

---

## Dependências Chave

### Backend
- `express` — servidor web
- `cheerio` — parse HTML/DOM (scraping)
- `node-fetch` — cliente HTTP
- `https-proxy-agent` — suporte a proxies HTTPS
- `dotenv` — variáveis de ambiente
- `@scrapeless-ai/sdk` — automação de browser

### Frontend
- `react` v19.2.0 + `react-dom`
- `tailwindcss` v4.1.18
- `chart.js` v4.5.1
- `gsap` v3.14.2 — animações
- `xlsx-js-style` v1.2.0 — exportação Excel
- `vite` v7.2.4 — build

---

## Decisões Arquiteturais

1. **Dois métodos de busca**: Traditional API (rápido, estruturado) vs Catalog API (agrega múltiplos vendedores)
2. **Gestão de sessão dual**: OAuth 2.0 para API oficial + cookie SID para scraping web
3. **Resiliência**: rate limiting + proxy rotation + retry logic + fallback values
4. **Enriquecimento de dados**: reputação, fulfillment, frete, taxas, parsing multi-formato de vendas
5. **SPA + API**: frontend React servido como build estático pelo próprio Express em produção
