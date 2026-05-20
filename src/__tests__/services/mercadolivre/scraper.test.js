import { describe, it, expect } from 'vitest';
import { getMarcaENumeroPeca, getCodigoOEM } from '../../../services/mercadolivre/scraper.js';

// Fixtures auxiliares
function makeHighlightedSpecs({ leftAttrs = [], rightAttrs = [] } = {}) {
    return {
        components: {
            content_left: [
                {
                    id: 'highlighted_specs_attrs',
                    components: [
                        {
                            id: 'technical_specifications',
                            specs: [
                                { column: 'LEFT', attributes: leftAttrs },
                                { column: 'RIGHT', attributes: rightAttrs },
                            ],
                        },
                    ],
                },
            ],
        },
    };
}

describe('getMarcaENumeroPeca', () => {
    it('retorna nulls quando data é undefined', () => {
        expect(getMarcaENumeroPeca(undefined)).toEqual({ marca: null, numeroPeca: null });
    });

    it('retorna nulls quando data está vazio', () => {
        expect(getMarcaENumeroPeca({})).toEqual({ marca: null, numeroPeca: null });
    });

    it('extrai marca e numeroPeca de leftAttributes', () => {
        const data = makeHighlightedSpecs({
            leftAttrs: [
                { id: 'Marca', text: 'Bosch' },
                { id: 'Número de peça', text: 'BP-123' },
            ],
        });
        const result = getMarcaENumeroPeca(data);
        expect(result.marca).toBe('Bosch');
        expect(result.numeroPeca).toBe('BP-123');
    });

    it('extrai via findAttribute (BRAND/PART_NUMBER) quando leftAttributes ausente', () => {
        const data = {
            attributes: [
                { id: 'BRAND', value_name: 'Toyota' },
                { id: 'PART_NUMBER', value_name: 'PT-456' },
            ],
        };
        const result = getMarcaENumeroPeca(data);
        expect(result.marca).toBe('Toyota');
        expect(result.numeroPeca).toBe('PT-456');
    });

    it('retorna null para marca quando não encontrada', () => {
        const data = makeHighlightedSpecs({ leftAttrs: [] });
        const result = getMarcaENumeroPeca(data);
        expect(result.marca).toBeNull();
    });
});

describe('getCodigoOEM', () => {
    it('retorna null quando data é undefined', () => {
        expect(getCodigoOEM(undefined)).toBeNull();
    });

    it('retorna null quando data está vazio', () => {
        expect(getCodigoOEM({})).toBeNull();
    });

    it('extrai OEM de rightAttributes', () => {
        const data = makeHighlightedSpecs({
            rightAttrs: [{ id: 'Código OEM', text: 'OEM-789' }],
        });
        expect(getCodigoOEM(data)).toBe('OEM-789');
    });

    it('extrai via findAttribute (OEM) quando rightAttributes ausente', () => {
        const data = {
            attributes: [{ id: 'OEM', value_name: 'OEM-XYZ' }],
        };
        expect(getCodigoOEM(data)).toBe('OEM-XYZ');
    });
});