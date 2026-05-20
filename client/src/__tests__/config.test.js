import { describe, it, expect } from 'vitest';
import { API_URL } from '../config.js';

describe('config', () => {
    it('API_URL é uma string', () => {
        expect(typeof API_URL).toBe('string');
    });

    it('API_URL permite URLs relativas (string vazia para produção)', () => {
        // String vazia = URL relativa, funciona quando Express serve o build do client
        expect(API_URL === '' || API_URL.startsWith('http')).toBe(true);
    });
});