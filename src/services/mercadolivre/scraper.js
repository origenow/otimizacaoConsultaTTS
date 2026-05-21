import fetch from "node-fetch";
import https from 'node:https';
import { config } from '../../config/index.js';
import { getAuthHeaders } from './auth.js';
import { getseller, simulateshippingCost, fetchSaleFees } from './client.js';
import { calcularMediaVendasPorDia } from '../../utils/calculations.js';


// Cache para armazenar respostas de requisições anteriores
const catalogCache = new Map();
const itemCache = new Map();

const ALLOWED_ML_HOSTS = new Set([
    'www.mercadolivre.com.br',
    'produto.mercadolivre.com.br',
    'lista.mercadolivre.com.br',
]);

const ML_ID_RE = /^[A-Z]{2,4}\d{3,20}$/;
const ML_SEARCH_HOST = 'https://lista.mercadolivre.com.br/';

function assertMeliHost(urlString) {
    const { hostname } = new URL(urlString);
    if (!ALLOWED_ML_HOSTS.has(hostname)) throw new Error(`Blocked host: ${hostname}`);
    return urlString;
}

function validateMlId(id) {
    const str = String(id ?? '');
    if (!ML_ID_RE.test(str)) throw new Error(`Invalid ML ID: ${str}`);
    return str;
}

function validateMlSearchUrl(url) {
    if (!String(url).startsWith(ML_SEARCH_HOST)) throw new Error(`Invalid ML search URL: ${url}`);
    return url;
}

function findAttribute(data, ids = [], labels = []) {
    const stack = [data];

    while (stack.length) {
        const obj = stack.pop();

        if (!obj || typeof obj !== "object") continue;

        const id = String(obj.id || "").toUpperCase();
        const text = String(obj.text || obj.name || obj.title?.text || "").toLowerCase();

        const matchId = ids.includes(id);
        const matchLabel = labels.some(label => text.includes(label.toLowerCase()));

        if (matchId || matchLabel) {
            return (
                obj.value_name ??
                obj.value ??
                obj.values?.[0]?.name ??
                obj.values?.[0]?.text ??
                obj.text ??
                null
            );
        }

        if (Array.isArray(obj)) {
            for (const item of obj) stack.push(item);
        } else {
            for (const value of Object.values(obj)) stack.push(value);
        }
    }

    return null;
}

export function getMarcaENumeroPeca(data) {
    const leftAttributes = data?.components?.content_left
        ?.find(obj => obj.id === "highlighted_specs_attrs")
        ?.components?.find(obj => obj.id === "technical_specifications")
        ?.specs?.find(obj => obj.column === "LEFT")
        ?.attributes;

    if (leftAttributes) {
        return {
        marca: leftAttributes?.find(obj => obj.id === "Marca")?.text || null,
        numeroPeca: leftAttributes?.find(obj => obj.id === "Número de peça")?.text || null,
        };
    }

    return {
        marca: findAttribute(data, ["BRAND"], ["Marca"]),
        numeroPeca: findAttribute(data, ["PART_NUMBER", "MPN"], ["Número de peça", "Numero de peça"]),
    };
}

export function getCodigoOEM(data) {
    const rightAttributes = data?.components?.content_left
        ?.find(obj => obj.id === "highlighted_specs_attrs")
        ?.components?.find(obj => obj.id === "technical_specifications")
        ?.specs?.find(obj => obj.column === "RIGHT")
        ?.attributes;

    return (
        rightAttributes?.find(obj => obj.id === "Código OEM")?.text ||
        findAttribute(data, ["OEM"], ["Código OEM", "Codigo OEM"]) ||
        null
    );
}

export async function ifCatalog(catalogID, xsrf, csrf, d2id, proxyIterator) {
    if (catalogID == null) {
        return { offers: [] };
    }

    // Verifica se já existe no cache
    if (catalogCache.has(catalogID)) {
        return catalogCache.get(catalogID);
    }

    let agent;

    // Seleciona um proxy aleatório se USE_PROXY estiver ativo
    if (config.USE_PROXY && proxyIterator) {
        const proxy = proxyIterator.next();
        const [host, port, user, pass] = proxy.split(':');
        const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
        agent = new https.Agent({ proxy: proxyUrl });
    }

    const _catalogUrl = new URL(`/p/api/products/${encodeURIComponent(validateMlId(catalogID))}/s`, 'https://www.mercadolivre.com.br');
    _catalogUrl.searchParams.set('page', '1');
    _catalogUrl.searchParams.set('quantity', '1');
    let url = _catalogUrl.toString();
    const fetchOptions = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
            'Connection': 'keep-alive',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrf,
            'x-csrf-token': xsrf,
            'Cookie': `_csrf=${csrf}; _d2id=${d2id}; ssid=${config.SID_COOKIE}`
        }
    };

    if (agent) {
        fetchOptions.agent = agent;
    }

    let response = await fetch(assertMeliHost(url), fetchOptions);
    let data;
    try {
        data = await response.json();
    } catch {
        console.error(`[ifCatalog] Resposta não-JSON para ${catalogID}, status ${response.status}`);
        return { offers: [] };
    }

    const items = data?.components?.results?.items || [];

    const result = {
        offers: (await Promise.all(items.map(async item => {
            try {
                const itemInfo = await ifTraditional(item.id, xsrf, csrf, d2id, proxyIterator);
                return {
                    id: item.id,
                    sales_quantity: itemInfo.sales_quantity,
                    startTime: itemInfo.startTime,
                    price: item.price?.value || null
                };
            } catch (err) {
                console.error(`[ifCatalog] Item ${item.id} falhou:`, err.message);
                return null;
            }
        }))).filter(Boolean)
    };

    catalogCache.set(catalogID, result);

    return result;
}



function parseSalesQuantity(subtitle) {
    if (!subtitle) return 0;
    const lowerSub = subtitle.toLowerCase().replaceAll('.', '').replace(',', '.');
    const milMatch = /([\d.]+)\s*(mil|milhares)/.exec(lowerSub);
    if (milMatch) return Number.parseFloat(milMatch[1]) * 1000;
    return Number.parseInt(/\d+/g.exec(lowerSub)?.[0] || 0, 10);
}

function extractThumbnail(data) {
    const pictures = data.components?.gallery?.pictures;
    if (pictures?.length > 0) {
        const firstPic = pictures[0];
        if (firstPic.url) return firstPic.url;
        if (firstPic.id) return `https://http2.mlstatic.com/D_NQ_NP_${firstPic.id}-O.webp`;
    }
    return data.components?.track?.gtm_event?.picture || null;
}

function detectFulfillment(data, logistic_type) {
    if (logistic_type === 'fulfillment') return true;
    const shippingStr = JSON.stringify(data.components?.shipping || {}).toLowerCase();
    if (shippingStr.includes('fulfillment') || /\bfull\b/.test(shippingStr)) return true;
    const highlightsStr = JSON.stringify(data.components?.highlights || data.components?.header?.tags || []).toLowerCase();
    return highlightsStr.includes('fulfillment') || /\bfull\b/.test(highlightsStr);
}

function inferFreeShipping(data, eventData) {
    if (eventData.free_shipping != null) return eventData.free_shipping;
    return JSON.stringify(data.components ?? {}).toLowerCase().includes("frete grátis");
}

export async function ifTraditional(itemID, xsrf, csrf, d2id, proxyIterator, _catalogID = null) {
    // Verifica se já existe no cache
    if (itemCache.has(itemID)) {
        return itemCache.get(itemID);
    }

    let agent;

    // Seleciona um proxy aleatório se USE_PROXY estiver ativo
    if (config.USE_PROXY && proxyIterator) {
        const proxy = proxyIterator.next();
        const [host, port, user, pass] = proxy.split(':');
        const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
        agent = new https.Agent({ proxy: proxyUrl });
    }

    const _itemUrl = new URL('/p/api/items', 'https://produto.mercadolivre.com.br');
    _itemUrl.searchParams.set('id', validateMlId(itemID));
    _itemUrl.searchParams.set('platform', 'ML');
    _itemUrl.searchParams.set('app', 'vip');
    let url = _itemUrl.toString();

    const fetchOptions = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
            'Connection': 'keep-alive',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrf,
            'x-csrf-token': xsrf,
            'Cookie': `_csrf=${csrf}; _d2id=${d2id}; ssid=${config.SID_COOKIE}`
        }
    };

    if (agent) {
        fetchOptions.agent = agent;
    }

    let response = await fetch(assertMeliHost(url), fetchOptions);
    let data;
    try {
        data = await response.json();
    } catch {
        console.error(`[ifTraditional] Resposta não-JSON para ${itemID}, status ${response.status}`);
        return {};
    }

    const subtitle = data.components?.header?.subtitle || '';
    const salesQuantity = parseSalesQuantity(subtitle);

    // Extrair startTime do caminho components.track.gtm_event.startTime
    const startTime = data.components?.track?.gtm_event?.startTime || null;

    // Extrair listingType
    const listingType = data.components?.track?.gtm_event?.listingType || null;

    // Extrair itemPrice
    // 1. Melidata (Prioridade aumentada para pegar preço cheio, não parcelado)
    let itemPrice = data.components?.track?.melidata_event?.event_data?.price || data.track?.melidata_event?.event_data?.price;

    // 2. GTM Event (Fallback)
    if (!itemPrice) {
        itemPrice = data.components?.track?.gtm_event?.itemPrice;
    }

    // 3. Components Price (Último recurso)
    if (!itemPrice) {
        itemPrice = data.components?.price?.value || null;
    }


    // Extrair categoryId do mesmo caminho (components.track.gtm_event.categoryId)
    const categoryId = data.components?.track?.gtm_event?.categoryId || null;

    // Extrair título do caminho components.short_description (array), procurar objeto com id "header"
    const shortDescription = data.components?.short_description || [];
    const headerObj = shortDescription.find(obj => obj.id === "header");
    const title = headerObj?.title || null;

    // Extrair Reviews do header
    const reviewsObj = headerObj?.reviews || {};
    const reviewRating = reviewsObj.rating || null;
    const reviewTotal = reviewsObj.amount || 0;

    const thumbnail = extractThumbnail(data);

    // Extrair dados do caminho track.melidata_event.event_data
    // Tentar primeiro em components.track.melidata_event.event_data, depois em track.melidata_event.event_data
    const eventData = data.components?.track?.melidata_event?.event_data || data.track?.melidata_event?.event_data || {};

    const free_shipping = inferFreeShipping(data, eventData);

    // Tentar inferir Listing Type para cálculo de frete
    let listing_type_id_from_event = eventData.listing_type_id;
    if (!listing_type_id_from_event) {
        // Default seguro para calcular frete se não soubermos
        listing_type_id_from_event = "gold_special";
    }

    const seller_id = eventData.seller_id || null;
    const reputation_level = eventData.reputation_level || null;
    const power_seller_status = eventData.power_seller_status || null;
    const shipping_mode = eventData.shipping_mode || 'me2'; // Default ME2
    const logistic_type = eventData.logistic_type || null;
    const quantity = eventData.quantity || null;
    const { marca, numeroPeca } = getMarcaENumeroPeca(data);
    const codigoOEM = getCodigoOEM(data);

    const is_fulfillment = detectFulfillment(data, logistic_type);

    const scrapedSales = Number.parseInt(salesQuantity, 10) || 0;

    const result = {
        id: itemID,
        sales_quantity: scrapedSales,
        startTime: startTime,
        listingType: listingType || listing_type_id_from_event,
        itemPrice: itemPrice,
        categoryId: categoryId,
        title: title,
        seller_id: seller_id,
        reputation_level: reputation_level,
        power_seller_status: power_seller_status,
        free_shipping: free_shipping,
        shipping_mode: shipping_mode,
        logistic_type: logistic_type,
        is_fulfillment: is_fulfillment,
        quantity: quantity,
        thumbnail: thumbnail,
        marca: marca,
        numeroPeca: numeroPeca,
        codigoOEM: codigoOEM,
        reviews: {
            rating: reviewRating,
            total: reviewTotal
        }
    };

    // Armazena no cache
    itemCache.set(itemID, result);

    return result;
}

export async function searchProducts(query, proxyIterator, accessToken) {
    const queryPath = encodeURIComponent(query.trim().toLowerCase()).replaceAll('%20', '-');
    const searchUrl = `https://lista.mercadolivre.com.br/${queryPath}`;

    // Obter headers de autenticação
    const authHeaders = await getAuthHeaders(proxyIterator);

    let agent;

    // Seleciona um proxy aleatório se USE_PROXY estiver ativo
    if (config.USE_PROXY && proxyIterator) {
        const proxy = proxyIterator.next();
        const [host, port, user, pass] = proxy.split(':');
        const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
        agent = new https.Agent({ proxy: proxyUrl });
    }

    const requestOptions = {
        method: "GET",
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
            'Connection': 'keep-alive',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `_csrf=${authHeaders.csrf}; _d2id=${authHeaders.d2id}; ssid=${config.SID_COOKIE}`
        },
        redirect: "follow"
    };

    if (agent) {
        requestOptions.agent = agent;
    }

    const _searchApiUrl = new URL('/api/search/client', 'https://www.mercadolivre.com.br');
    _searchApiUrl.searchParams.set('url', validateMlSearchUrl(searchUrl));
    let response = await fetch(assertMeliHost(_searchApiUrl.toString()), requestOptions)
        .then((response) => response.json())
        .then((result) => {
            return result;
        })
        .catch((error) => {
            console.error('Erro ao buscar produtos:', error);
            return { melidata_track: { event_data: { printed_result: [] } } };
        });

    // Handle cases where response is wrapped in { data: ... }
    const rootData = response.data || response;

    // Check for Login Redirect (Blocking)
    if (rootData.login || rootData.data?.login) {
        console.error("❌ [ERRO CRÍTICO] O Mercado Livre redirecionou para o Login.");
        throw new Error('AUTH_EXPIRED');
    }

    // Extrair item_id e product_id do caminho melidata_track.event_data.printed_result
    const printedResults = rootData?.melidata_track?.event_data?.printed_result || [];

    // Criar array de resultados com item_id, product_id e logistic_type da busca
    response = printedResults.map(item => ({
        item_id: item.item_id,
        product_id: item.product_id || null,
        search_logistic_type: item.logistic_type || null
    })).filter(item => item.item_id); // Filtrar itens sem item_id

    // Buscar detalhes de cada item usando o endpoint de produto
    const itemsProcessed = await Promise.all(response.map(async (item) => {
        const itemID = item.item_id;
        const productID = item.product_id;

        let itemInfo;
        try {
            itemInfo = await ifTraditional(itemID, authHeaders.xsrf, authHeaders.csrf, authHeaders.d2id, proxyIterator, productID);
        } catch (err) {
            console.error(`[searchProducts] ifTraditional falhou para ${itemID}:`, err.message);
            return null;
        }

        if (!itemInfo?.id) {
            return null;
        }

        let offers = [];
        try {
            offers = productID ? (await ifCatalog(productID, authHeaders.xsrf, authHeaders.csrf, authHeaders.d2id, proxyIterator)).offers : [];
        } catch (err) {
            console.error(`[searchProducts] ifCatalog falhou para ${productID}:`, err.message);
        }

        // Formatar itemID: se já começar com MLB, remover e adicionar no formato correto MLB-{id}
        const formattedItemID = itemID.startsWith('MLB') ? `MLB-${itemID.substring(3)}` : `MLB-${itemID}`;

        return {
            id: itemInfo.id,
            title: itemInfo.title || null,
            catalog_product_id: productID,
            catalog_listing: null, // Não temos mais acesso a essa informação
            category_id: itemInfo.categoryId || null,
            listing_type_id: itemInfo.listingType || null,
            permalink: `https://produto.mercadolivre.com.br/${formattedItemID}`,
            price: itemInfo.itemPrice || null,
            seller_id: itemInfo.seller_id || null,
            logistic_type: itemInfo.logistic_type || null,
            // Combina sinais da VIP API e da busca para detecção robusta de fulfillment
            is_fulfillment: itemInfo.is_fulfillment || item.search_logistic_type === 'fulfillment',
            shipping_mode: itemInfo.shipping_mode || null,
            attributes: [], // Não temos mais acesso a atributos
            startTime: itemInfo.startTime || null,
            sales_quantity: itemInfo.sales_quantity || 0,
            offers: offers,
            cep: config.CEP,
            // Dados do evento para uso posterior
            reputation_level: itemInfo.reputation_level,
            power_seller_status: itemInfo.power_seller_status,
            free_shipping: itemInfo.free_shipping,
            quantity: itemInfo.quantity,
            thumbnail: itemInfo.thumbnail,
            marca: itemInfo.marca || null,
            numeroPeca: itemInfo.numeroPeca || null,
            codigoOEM: itemInfo.codigoOEM || null,
            reviews: itemInfo.reviews
        };
    }));

    // Remover itens nulos ou sem dados essenciais (titulo ou preço)
    // Filtro mais robusto: ID deve começar com MLB e Preço deve ser numérico
    response = itemsProcessed.filter(item =>
        item !== null &&
        item.title &&
        (typeof item.price === 'number' && !Number.isNaN(item.price)) &&
        item.id.toUpperCase().startsWith('MLB')
    );

    // Buscar informações dos vendedores
    const sellers = await getseller(accessToken, response);

    const [shippingCosts, saleFees] = await Promise.all([
        simulateshippingCost(accessToken, response, 50),
        fetchSaleFees(accessToken, response)
    ]);


    response = response.map(item => {
        item.offers = item.offers.map(offer => {
            const ttsData = calcularMediaVendasPorDia(offer.startTime, offer.sales_quantity);
            offer.tts = ttsData.tts;
            offer.intervalo_dias = ttsData.intervalo_dias;
            offer.vendas_1_dia = ttsData.vendas_1_dia;
            offer.vendas_7_dias = ttsData.vendas_7_dias;
            offer.vendas_15_dias = ttsData.vendas_15_dias;
            offer.vendas_30_dias = ttsData.vendas_30_dias;
            offer.velocity = ttsData.velocity;
            offer.sales_per_month = ttsData.sales_per_month;
            return offer;
        })

        if (item.offers.length == 0) {
            // Cálculo Individual
            const ttsData = calcularMediaVendasPorDia(item.startTime, item.sales_quantity);
            item.tts = ttsData.tts;
            item.velocity = ttsData.velocity;
            item.sales_per_month = ttsData.sales_per_month;
            item.intervalo_dias = ttsData.intervalo_dias;
            item.vendas_1_dia = ttsData.vendas_1_dia;
            item.vendas_7_dias = ttsData.vendas_7_dias;
            item.vendas_15_dias = ttsData.vendas_15_dias;
            item.vendas_30_dias = ttsData.vendas_30_dias;
            item.metodo_calculo = 'Individual';
        } else {
            // Cálculo Média de Catálogo
            // Aqui pegamos as 3 offers com maior número de vendas (sales_quantity)
            const melhoresOffers = item.offers
                .slice()
                .sort((a, b) => b.sales_quantity - a.sales_quantity)
                .slice(0, 3);

            // Calcula a média dos tts das 3 offers com mais vendas
            const somaTts = melhoresOffers.reduce((acc, offer) => acc + (offer.tts || 999), 0);
            item.tts = Number((somaTts / melhoresOffers.length).toFixed(2));

            // Calcula a média de Velocity das 3 offers com mais vendas
            const somaVelocity = melhoresOffers.reduce((acc, offer) => acc + (offer.velocity || 0), 0);
            item.velocity = Number((somaVelocity / melhoresOffers.length).toFixed(1));

            // Calcula vendas projetadas baseadas na Velocity média
            item.sales_per_month = Number((item.velocity * 30).toFixed(1));
            item.vendas_1_dia = Number((item.velocity * 1).toFixed(2));
            item.vendas_7_dias = Number((item.velocity * 7).toFixed(2));
            item.vendas_15_dias = Number((item.velocity * 15).toFixed(2));
            item.vendas_30_dias = item.sales_per_month;

            // Calcula a média de TTS de TODAS as offers (apenas informativo)
            const somaTtsTotal = item.offers.reduce((acc, offer) => acc + (offer.tts || 999), 0);
            item.catalog_tts_avg = item.offers.length > 0 ? Number((somaTtsTotal / item.offers.length).toFixed(2)) : 0;

            // Para catálogo, não calculamos intervalo_dias
            item.intervalo_dias = null;

            // Calcula a média das sales_quantity das 3 offers com mais vendas
            const somaSales = melhoresOffers.reduce((acc, offer) => acc + offer.sales_quantity, 0);
            item.sales_quantity = Math.round(somaSales / melhoresOffers.length);

            item.metodo_calculo = 'Média de Catálogo';
        }

        const shippingCost = shippingCosts.find(shipping => shipping.id == item.id);
        item.shipping_cost = shippingCost ? shippingCost.cost : 999;

        const saleFee = saleFees.find(saleFee => saleFee.id == item.id);
        item.sale_fee_amount = saleFee ? saleFee.sale_fee_amount : null;

        // Buscar informações do vendedor
        const seller = sellers.find(s => s.id == item.seller_id);
        if (seller) {
            item.nickname = seller.nickname || null;
            item.city = seller.address?.city || null;
            // Remover "BR-" do estado se presente
            let state = seller.address?.state || null;
            if (state?.startsWith('BR-')) {
                state = state.substring(3);
            }
            item.state = state;
            item.seller_transactions = seller.seller_reputation?.transactions?.total || null;
            item.power_seller_status = seller.seller_reputation?.power_seller_status || item.power_seller_status || null;
            item.level_id = seller.seller_reputation?.level_id || item.reputation_level || null;
        } else {
            item.nickname = null;
            item.city = null;
            item.state = null;
            item.seller_transactions = null;
            item.power_seller_status = item.power_seller_status || null;
            item.level_id = item.reputation_level || null;
        }

        delete item.cep;
        delete item.reputation_level;

        return item;
    })


    let res = { response: response };

    return res;
}
