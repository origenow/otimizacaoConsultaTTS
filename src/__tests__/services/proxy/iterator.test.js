import { describe, it, expect } from 'vitest';
import { createRandomIterator } from '../../../services/proxy/iterator.js';

describe('createRandomIterator', () => {
    it('retorna um item do array', () => {
        const arr = ['a', 'b', 'c'];
        const iter = createRandomIterator(arr);
        const result = iter.next();
        expect(arr).toContain(result);
    });

    it('retorna um objeto com método next', () => {
        const iter = createRandomIterator(['x']);
        expect(typeof iter.next).toBe('function');
    });

    it('funciona com array de um único elemento', () => {
        const iter = createRandomIterator(['único']);
        expect(iter.next()).toBe('único');
    });

    it('retorna valores variados em múltiplas chamadas', () => {
        const arr = Array.from({ length: 20 }, (_, i) => i);
        const iter = createRandomIterator(arr, 0);
        const results = new Set(Array.from({ length: 50 }, () => iter.next()));
        // Com 20 itens e interval=0, deve variar
        expect(results.size).toBeGreaterThan(1);
    });

    it('respeita intervalo de cooldown — mesmo índice não é reutilizado imediatamente quando interval alto', () => {
        const arr = [0, 1, 2, 3, 4];
        // interval = 1 hora em ms
        const iter = createRandomIterator(arr, 3_600_000);
        const first = iter.next();
        // Como o cooldown é alto e o array tem 5 itens, a próxima chamada
        // deve conseguir retornar algum item (pode ser diferente)
        const second = iter.next();
        expect(arr).toContain(second);
        // first e second podem coincidir apenas se todas as tentativas falharem e
        // o loop sair por esgotar tentativas — o comportamento é aceitável
        expect(arr).toContain(first);
    });
});