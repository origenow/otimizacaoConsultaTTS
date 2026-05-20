import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProxyList } from '../../../services/proxy/provider.js';

vi.mock('node-fetch', () => ({
    default: vi.fn(),
}));

import fetch from 'node-fetch';

describe('getProxyList', () => {
    beforeEach(() => vi.clearAllMocks());

    it('retorna a lista de proxies do campo results', async () => {
        const proxies = [{ proxy_address: '1.2.3.4', port: 8080 }];
        fetch.mockResolvedValue({
            json: async () => ({ results: proxies }),
        });

        const result = await getProxyList('my-token');
        expect(result).toEqual(proxies);
    });

    it('chama a URL correta do Webshare com os parâmetros certos', async () => {
        fetch.mockResolvedValue({ json: async () => ({ results: [] }) });

        await getProxyList('tok123');

        const calledUrl = fetch.mock.calls[0][0];
        expect(calledUrl).toContain('proxy.webshare.io');
        expect(calledUrl).toContain('mode=direct');
        expect(calledUrl).toContain('page_size=2000');
    });

    it('inclui o token de autenticação no header', async () => {
        fetch.mockResolvedValue({ json: async () => ({ results: [] }) });

        await getProxyList('tok-abc');

        const options = fetch.mock.calls[0][1];
        const authHeader = options.headers.get('Authorization');
        expect(authHeader).toBe('Token tok-abc');
    });

    it('retorna undefined e não lança quando fetch falha', async () => {
        fetch.mockRejectedValue(new Error('network error'));
        const result = await getProxyList('tok');
        expect(result).toBeUndefined();
    });
});