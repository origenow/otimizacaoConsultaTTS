import fetch from "node-fetch";
import https from 'node:https';
import { config } from '../../config/index.js';
import { getAuthHeaders } from './auth.js';
import { getseller, simulateshippingCost, fetchSaleFees } from './client.js';
import { calcularMediaVendasPorDia } from '../../utils/calculations.js';


// Cache para armazenar respostas de requisições anteriores
const catalogCache = new Map();
const itemCache = new Map();

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

    let url = `https://www.mercadolivre.com.br/p/api/products/${encodeURIComponent(catalogID)}/s?page=1&quantity=1`;
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

    let response = await fetch(url, fetchOptions);
    let data = await response.json();



    const result = {
        offers: await Promise.all(data.components.results.items.map(async item => {
            const itemInfo = await ifTraditional(item.id, xsrf, csrf, d2id, proxyIterator);


            return {
                id: item.id,
                sales_quantity: itemInfo.sales_quantity,
                startTime: itemInfo.startTime,
                price: item.price?.value || null
            };
        }))
    };

    // Armazena no cache
    catalogCache.set(catalogID, result);

    return result;
}



export async function ifTraditional(itemID, xsrf, csrf, d2id, proxyIterator, catalogID = null) {
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

    let url = `https://produto.mercadolivre.com.br/p/api/items?id=${encodeURIComponent(itemID)}&platform=ML&app=vip`;

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

    let response = await fetch(url, fetchOptions);
    let data = await response.json();

    // Extrair e formatar o número de vendas
    const subtitle = data.components?.header?.subtitle || '';

    // --- PARSING APRIMORADO DE VENDAS (MILS/MILHARES) ---
    // Ex: "+10 mil vendidos", "+5 mil vendidos", "1000 vendidos"
    let salesQuantity = 0;
    if (subtitle) {
        const lowerSub = subtitle.toLowerCase().replaceAll('.', '').replace(',', '.'); // Normalize dot/comma

        // 1. Check for "mil" or "milhares" patterns (e.g. "+5 mil", "10 mil")
        const milMatch = /([\d.]+)\s*(mil|milhares)/.exec(lowerSub);
        if (milMatch) {
            const numberPart = Number.parseFloat(milMatch[1]);
            salesQuantity = numberPart * 1000;
        } else {
            // 2. Normal number extraction if no "mil"
            salesQuantity = Number.parseInt(lowerSub.match(/\d+/g)?.join('') || 0, 10);
        }
    }

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
        const priceComponent = data.components?.price;
        if (priceComponent && priceComponent.value) {
            itemPrice = priceComponent.value;
        }
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

    // Extrair Imagem (Thumbnail) - Robustez para VIP API
    let thumbnail = null;
    // 1. Tenta pegar do Gallery usando ID e Template
    const gallery = data.components?.gallery || {};
    if (gallery.pictures && gallery.pictures.length > 0) {
        const firstPic = gallery.pictures[0];
        if (firstPic.url) {
            thumbnail = firstPic.url;
        } else if (firstPic.id) {
            // Constrói URL padrão do ML
            thumbnail = `https://http2.mlstatic.com/D_NQ_NP_${firstPic.id}-O.webp`;
        }
    }
    // 2. Fallback GTM
    if (!thumbnail) {
        thumbnail = data.components?.track?.gtm_event?.picture;
    }

    // Extrair dados do caminho track.melidata_event.event_data
    // Tentar primeiro em components.track.melidata_event.event_data, depois em track.melidata_event.event_data
    const eventData = data.components?.track?.melidata_event?.event_data || data.track?.melidata_event?.event_data || {};

    // Tentar inferir Frete Grátis se eventData falhar
    let free_shipping = eventData.free_shipping;
    if (free_shipping == null) {
        // Tenta achar texto de frete grátis nos componentes visuais
        const jsonString = JSON.stringify(data.components ?? {});
        if (jsonString.toLowerCase().includes("frete grátis")) {
            free_shipping = true;
        } else {
            free_shipping = false;
        }
    }

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

    // Detecção robusta de Fulfillment (Full) - verifica múltiplas fontes
    let is_fulfillment = logistic_type === 'fulfillment';

    // Fallback 1: verificar componente de shipping por indicadores de fulfillment
    if (!is_fulfillment) {
        const shippingStr = JSON.stringify(data.components?.shipping || {}).toLowerCase();
        // Padrões comuns: "Full", "Enviado pelo Full", "fulfillment"
        is_fulfillment = shippingStr.includes('fulfillment') || /\bfull\b/.test(shippingStr);
    }

    // Fallback 2: verificar highlights/tags do componente por indicadores de fulfillment
    if (!is_fulfillment) {
        const highlightsStr = JSON.stringify(data.components?.highlights || data.components?.header?.tags || []).toLowerCase();
        is_fulfillment = highlightsStr.includes('fulfillment') || /\bfull\b/.test(highlightsStr);
    }

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
    // Formatar o termo de pesquisa para URL (ex: "boneca barbie" -> "boneca-barbie")
    const queryFormatted = query.toLowerCase().replace(/\s+/g, '-');
    const searchUrl = `https://lista.mercadolivre.com.br/${queryFormatted}`;

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

    let response = await fetch(`https://www.mercadolivre.com.br/api/search/client?url=${encodeURIComponent(searchUrl)}`, requestOptions)
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
    if (rootData.login || (rootData.data && rootData.data.login)) {
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

        // Buscar informações do endpoint de produto (startTime, listingType, itemPrice, categoryId, title)
        const itemInfo = await ifTraditional(itemID, authHeaders.xsrf, authHeaders.csrf, authHeaders.d2id, proxyIterator, productID);

        if (!itemInfo || !itemInfo.id) {
            return null;
        }

        // Buscar offers se houver product_id
        const offers = productID ? (await ifCatalog(productID, authHeaders.xsrf, authHeaders.csrf, authHeaders.d2id, proxyIterator)).offers : [];

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
            if (state && typeof state === 'string' && state.startsWith('BR-')) {
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

        // Limpar campos temporários
        delete item.cep;
        delete item.reputation_level;
        // delete item.free_shipping; // Mantendo para frontend
        // delete item.quantity; // Mantendo para frontend

        return item;
    })


    let res = { response: response };

    return res;
}
