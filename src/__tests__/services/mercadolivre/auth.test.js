import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken, getAuthHeaders } from '../../../services/mercadolivre/auth.js';

vi.mock('node-fetch', () => ({
    default: vi.fn(),
}));

import fetch from 'node-fetch';

describe('getAccessToken', () => {
    beforeEach(() => vi.clearAllMocks());

    it('retorna o access_token da resposta', async () => {
        fetch.mockResolvedValue({
            json: async () => ({ access_token: 'token-abc-123' }),
        });

        const token = await getAccessToken();
        expect(token).toBe('token-abc-123');
    });

    it('faz POST para o endpoint correto', async () => {
        fetch.mockResolvedValue({
            json: async () => ({ access_token: 'x' }),
        });

        await getAccessToken();
        expect(fetch).toHaveBeenCalledWith(
            'https://api.mercadolibre.com/oauth/token',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('retorna undefined e não lança quando fetch falha', async () => {
        fetch.mockRejectedValue(new Error('network error'));
        const result = await getAccessToken();
        expect(result).toBeUndefined();
    });
});

describe('getAuthHeaders', () => {
    beforeEach(() => vi.clearAllMocks());

    it('retorna tokens extraídos dos cookies e meta tag', async () => {
        fetch.mockResolvedValue({
            headers: {
                get: () => '_csrf=csrf-val; Path=/, _d2id=d2id-val; Path=/',
            },
            text: async () => '<html><head><meta name="csrf-token" content="xsrf-val"/></head></html>',
        });

        const tokens = await getAuthHeaders(null);
        expect(tokens.csrf).toBe('csrf-val');
        expect(tokens.d2id).toBe('d2id-val');
        expect(tokens.xsrf).toBe('xsrf-val');
    });

    it('retorna objeto vazio quando fetch falha', async () => {
        fetch.mockRejectedValue(new Error('timeout'));
        const tokens = await getAuthHeaders(null);
        expect(tokens).toEqual({});
    });
});