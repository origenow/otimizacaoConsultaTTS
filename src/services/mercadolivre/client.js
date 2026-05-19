import fetch from "node-fetch";

export async function getseller(accessToken, sellerIds) {
    try {
        // Extrai apenas os IDs dos vendedores, filtrando nulos
        const ids = sellerIds.map(obj => obj.seller_id).filter(id => id != null);

        if (ids.length === 0) {
            return [];
        }

        // Função auxiliar para buscar informações dos vendedores em lotes de até 20
        const fetchItems = async (group) => {
            const url = `https://api.mercadolibre.com/users?ids=${group.join(',')}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const data = await response.json();
            // Retorna apenas o corpo de cada resposta
            return data.map(item => item.body);
        };

        // Divide os IDs em grupos de 20
        const groups = [];
        for (let i = 0; i < ids.length; i += 20) {
            groups.push(ids.slice(i, i + 20));
        }

        // Busca as informações dos vendedores em paralelo
        const responses = await Promise.all(groups.map(group => fetchItems(group)));

        // Achata o array de arrays em um único array de resultados
        return [].concat(...responses);
    } catch (error) {
        console.error("Erro no processamento geral:", error);
        throw error;
    }
}

export async function simulateshippingCost(accessToken, items, batchSize) {
    try {
        const resultados = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);

            const batchResults = await Promise.all(
                batch.map(async (item) => {
                    try {
                        const response = await fetch(
                            `https://api.mercadolibre.com/items/${item.id}/shipping_options?zip_code=${item.cep}#json`,
                            {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                },
                            }
                        );
                        const data = await response.json();

                        if (data && Array.isArray(data.options)) {
                            const recomendado = data.options.find(
                                (obj) => obj.display === "recommended"
                            );
                            const custo = recomendado ? recomendado.list_cost : 0;
                            return { id: item.id, cost: custo };
                        } else {
                            return { id: item.id, cost: 999 };
                        }
                    } catch (error) {
                        console.error(error);
                        return { id: item.id, cost: 999 };
                    }
                })
            );

            resultados.push(...batchResults);
        }

        return resultados;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

export async function fetchSaleFees(accessToken, items) {
    try {
        const resultados = await Promise.all(
            items.map(async (obj) => {
                try {
                    // Verificar se tem os dados necessários
                    if (!obj.category_id || !obj.listing_type_id || !obj.price) {
                        return { id: obj.id, sale_fee_amount: null, listing_type_name: null };
                    }

                    const url = `https://api.mercadolibre.com/sites/MLB/listing_prices?price=${obj.price}&category_id=${obj.category_id}&currency_id=BRL&listing_type_id=${obj.listing_type_id}`;
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    });
                    const mainData = await response.json();

                    return {
                        id: obj.id,
                        sale_fee_amount: mainData.sale_fee_amount || null,
                        listing_type_name: mainData.listing_type_name || null,
                    };
                } catch (error) {
                    console.error('Erro na requisição:', error);
                    return { id: obj.id, sale_fee_amount: null, listing_type_name: null };
                }
            })
        );

        // Filtra nulos caso haja algum erro individual
        return resultados.filter((item) => item !== null);
    } catch (error) {
        console.error('Erro geral ao buscar taxas de venda:', error);
        throw error;
    }
}
