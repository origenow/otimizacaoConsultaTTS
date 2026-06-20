export function calcularMediaVendasPorDia(dataISO, valorInteiro) {
    // Se qualquer parâmetro for inválido
    if (!dataISO || dataISO === null || dataISO === 0) {
        return createEmptyMetrics();
    }

    // Se vendas for 0, TTS fica infinito (999 para ordenação)
    if (valorInteiro === 0 || valorInteiro === null || valorInteiro === undefined) {
        return createEmptyMetrics();
    }

    const dataInicial = new Date(dataISO);
    const dataAtual = new Date();

    // Verificar se a data é válida
    if (isNaN(dataInicial.getTime())) {
        return createEmptyMetrics();
    }

    // Diferença em milissegundos
    const diffMs = dataAtual - dataInicial;

    // Converte para dias
    const diasPassados = Math.max(
        Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
        1
    );

    // TTS = Dias / Vendas
    // Ex: 30 dias / 10 vendas = 3 dias por venda
    // Quanto MENOR = vende mais rápido
    const tts = Number((diasPassados / valorInteiro).toFixed(4));

    // Vendas por dia
    const salesPerDay = valorInteiro / diasPassados;

    // Projeções
    const vendas_1_dia = Number((salesPerDay * 1).toFixed(2));
    const vendas_7_dias = Number((salesPerDay * 7).toFixed(2));
    const vendas_15_dias = Number((salesPerDay * 15).toFixed(2));
    const vendas_30_dias = Number((salesPerDay * 30).toFixed(2));

    return {
        tts: tts, // DIAS para vender 1 unidade
        velocity: Number(salesPerDay.toFixed(1)), // Vendas por dia
        sales_per_month: Number(vendas_30_dias.toFixed(1)),
        intervalo_dias: diasPassados,
        vendas_1_dia: vendas_1_dia,
        vendas_7_dias: vendas_7_dias,
        vendas_15_dias: vendas_15_dias,
        vendas_30_dias: vendas_30_dias
    };
}

function createEmptyMetrics() {
    return {
        tts: 999,
        velocity: 0,
        sales_per_month: 0,
        intervalo_dias: 0,
        vendas_1_dia: 0,
        vendas_7_dias: 0,
        vendas_15_dias: 0,
        vendas_30_dias: 0
    };
}

// Mediana resistente a outliers. Ignora valores não-numéricos.
export function mediana(numeros) {
    const arr = (numeros || [])
        .filter((n) => typeof n === 'number' && !isNaN(n))
        .slice()
        .sort((a, b) => a - b);
    if (arr.length === 0) return 0;
    const meio = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[meio] : (arr[meio - 1] + arr[meio]) / 2;
}

// Considera uma offer "vendedora" quando tem TTS real (não o sentinela 999).
function offerVende(offer) {
    return offer && typeof offer.tts === 'number' && offer.tts > 0 && offer.tts < 999;
}

// Métricas de um produto de catálogo (várias offers concorrentes na mesma página).
// Usa apenas as offers que realmente vendem e a MEDIANA das 3 com mais vendas,
// para que uma offer sem dados (tts=999) não envenene a média do catálogo.
// Se nenhuma offer vende, cai no cálculo individual do próprio item (dado real),
// em vez de inventar 999 dentro de uma média.
export function calcularMetricasCatalogo(item) {
    const offers = Array.isArray(item.offers) ? item.offers : [];

    // TTS médio de TODAS as offers reais (apenas informativo) — também ignora o 999.
    const ttsReais = offers.map((o) => o.tts).filter((t) => typeof t === 'number' && t > 0 && t < 999);
    const catalog_tts_avg = ttsReais.length
        ? Number((ttsReais.reduce((a, b) => a + b, 0) / ttsReais.length).toFixed(2))
        : null;

    const topVendedoras = offers
        .filter(offerVende)
        .sort((a, b) => (b.sales_quantity || 0) - (a.sales_quantity || 0))
        .slice(0, 3);

    if (topVendedoras.length === 0) {
        const ind = calcularMediaVendasPorDia(item.startTime, item.sales_quantity);
        return { ...ind, catalog_tts_avg, metodo_calculo: 'Catálogo sem vendas' };
    }

    const tts = Number(mediana(topVendedoras.map((o) => o.tts)).toFixed(2));
    const velocity = Number(mediana(topVendedoras.map((o) => o.velocity || 0)).toFixed(1));
    const sales_per_month = Number((velocity * 30).toFixed(1));
    const somaSales = topVendedoras.reduce((acc, o) => acc + (o.sales_quantity || 0), 0);

    return {
        tts,
        velocity,
        sales_per_month,
        intervalo_dias: null,
        vendas_1_dia: Number((velocity * 1).toFixed(2)),
        vendas_7_dias: Number((velocity * 7).toFixed(2)),
        vendas_15_dias: Number((velocity * 15).toFixed(2)),
        vendas_30_dias: sales_per_month,
        catalog_tts_avg,
        sales_quantity: Math.round(somaSales / topVendedoras.length),
        metodo_calculo: 'Média de Catálogo',
    };
}
