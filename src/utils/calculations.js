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
    if (Number.isNaN(dataInicial.getTime())) {
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
