import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '../../components/LoginPage.jsx';

describe('LoginPage', () => {
    it('renderiza os campos de usuário e senha', () => {
        render(<LoginPage onLogin={vi.fn()} />);
        expect(screen.getByLabelText(/usuário/i)).toBeDefined();
        expect(screen.getByLabelText(/senha/i)).toBeDefined();
    });

    it('renderiza o botão de submit', () => {
        render(<LoginPage onLogin={vi.fn()} />);
        expect(screen.getByRole('button', { name: /entrar/i })).toBeDefined();
    });

    it('atualiza o campo de usuário ao digitar', () => {
        render(<LoginPage onLogin={vi.fn()} />);
        const input = screen.getByLabelText(/usuário/i);
        fireEvent.change(input, { target: { value: 'admin' } });
        expect(input.value).toBe('admin');
    });

    it('atualiza o campo de senha ao digitar', () => {
        render(<LoginPage onLogin={vi.fn()} />);
        const input = screen.getByLabelText(/senha/i);
        fireEvent.change(input, { target: { value: 'secret' } });
        expect(input.value).toBe('secret');
    });

    it('chama onLogin após submit', async () => {
        vi.useFakeTimers();
        const onLogin = vi.fn();
        render(<LoginPage onLogin={onLogin} />);

        fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'));
        vi.advanceTimersByTime(1000);
        expect(onLogin).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});