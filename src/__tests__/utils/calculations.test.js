import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { calcularMediaVendasPorDia } from '../../utils/calculations.js';

const EMPTY = {
    tts: 999,
    velocity: 0,
    sales_per_month: 0,
    intervalo_dias: 0,
    vendas_1_dia: 0,
    vendas_7_dias: 0,
    vendas_15_dias: 0,
    vendas_30_dias: 0,
};

describe('calcularMediaVendasPorDia', () => {
    beforeAll(() => {
        vi.useFakeTimers();
        // Fix "now" to 2026-05-20 (30 days after the reference date below)
        vi.setSystemTime(new Date('2026-05-20T00:00:00.000Z'));
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    it('retorna métricas zeradas para dataISO nula', () => {
        expect(calcularMediaVendasPorDia(null, 10)).toEqual(EMPTY);
    });

    it('retorna métricas zeradas para dataISO falsy (0)', () => {
        expect(calcularMediaVendasPorDia(0, 10)).toEqual(EMPTY);
    });

    it('retorna métricas zeradas para dataISO inválida', () => {
        expect(calcularMediaVendasPorDia('nao-e-data', 10)).toEqual(EMPTY);
    });

    it('retorna métricas zeradas para vendas = 0', () => {
        expect(calcularMediaVendasPorDia('2026-04-20T00:00:00.000Z', 0)).toEqual(EMPTY);
    });

    it('retorna métricas zeradas para vendas = null', () => {
        expect(calcularMediaVendasPorDia('2026-04-20T00:00:00.000Z', null)).toEqual(EMPTY);
    });

    it('retorna métricas zeradas para vendas = undefined', () => {
        expect(calcularMediaVendasPorDia('2026-04-20T00:00:00.000Z', undefined)).toEqual(EMPTY);
    });

    it('calcula corretamente com 30 dias e 30 vendas (1 venda/dia)', () => {
        // 2026-05-20 - 2026-04-20 = 30 dias
        const result = calcularMediaVendasPorDia('2026-04-20T00:00:00.000Z', 30);
        expect(result.intervalo_dias).toBe(30);
        expect(result.velocity).toBe(1);
        expect(result.tts).toBe(1);
        expect(result.vendas_7_dias).toBe(7);
        expect(result.vendas_30_dias).toBe(30);
    });

    it('calcula corretamente com 30 dias e 60 vendas (2 vendas/dia)', () => {
        const result = calcularMediaVendasPorDia('2026-04-20T00:00:00.000Z', 60);
        expect(result.velocity).toBe(2);
        expect(result.tts).toBe(0.5);
        expect(result.vendas_7_dias).toBe(14);
    });

    it('garante mínimo de 1 dia quando data é hoje', () => {
        const result = calcularMediaVendasPorDia('2026-05-20T00:00:00.000Z', 10);
        expect(result.intervalo_dias).toBeGreaterThanOrEqual(1);
        expect(result.tts).toBeGreaterThan(0);
    });
});