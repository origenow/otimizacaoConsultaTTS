import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getseller, simulateshippingCost, fetchSaleFees } from '../../../services/mercadolivre/client.js';

vi.mock('node-fetch', () => ({
    default: vi.fn(),
}));

import fetch from 'node-fetch';

describe('getseller', () => {
    beforeEach(() => vi.clearAllMocks());

    it('retorna array vazio quando não há IDs válidos', async () => {
        const result = await getseller('tok', [{ seller_id: null }]);
        expect(result).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('retorna dados dos vendedores', async () => {
        fetch.mockResolvedValue({
            json: async () => [{ body: { id: 1, nickname: 'vendedor1' } }],
        });

        const result = await getseller('tok', [{ seller_id: 1 }]);
        expect(result).toEqual([{ id: 1, nickname: 'vendedor1' }]);
    });

    it('divide IDs em grupos de 20', async () => {
        const sellers = Array.from({ length: 25 }, (_, i) => ({ seller_id: i + 1 }));
        fetch.mockResolvedValue({ json: async () => [] });

        await getseller('tok', sellers);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('simulateshippingCost', () => {
    beforeEach(() => vi.clearAllMocks());

    it('retorna custo recomendado quando opção existe', async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                options: [{ display: 'recommended', list_cost: 25.5 }],
            }),
        });

        const result = await simulateshippingCost('tok', [{ id: 'MLB1', cep: '01310100' }], 10);
        expect(result).toEqual([{ id: 'MLB1', cost: 25.5 }]);
    });

    it('retorna custo 0 quando opção recomendada não existe', async () => {
        fetch.mockResolvedValue({
            json: async () => ({ options: [{ display: 'normal', list_cost: 10 }] }),
        });

        const result = await simulateshippingCost('tok', [{ id: 'MLB2', cep: '01310100' }], 10);
        expect(result[0].cost).toBe(0);
    });

    it('retorna 999 quando fetch falha para o item', async () => {
        fetch.mockRejectedValue(new Error('timeout'));
        const result = await simulateshippingCost('tok', [{ id: 'MLB3', cep: '01310100' }], 10);
        expect(result[0].cost).toBe(999);
    });
});

describe('fetchSaleFees', () => {
    beforeEach(() => vi.clearAllMocks());

    it('retorna null quando campos obrigatórios estão ausentes', async () => {
        const result = await fetchSaleFees('tok', [{ id: 'MLB1' }]);
        expect(result[0].sale_fee_amount).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('retorna taxa de venda quando dados completos', async () => {
        fetch.mockResolvedValue({
            json: async () => ({ sale_fee_amount: 12.5, listing_type_name: 'Ouro Premium' }),
        });

        const result = await fetchSaleFees('tok', [{
            id: 'MLB1',
            category_id: 'MLB123',
            listing_type_id: 'gold_premium',
            price: 100,
        }]);

        expect(result[0].sale_fee_amount).toBe(12.5);
        expect(result[0].listing_type_name).toBe('Ouro Premium');
    });
});