import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CookieUpdaterModal from '../../components/CookieUpdaterModal.jsx';

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue(undefined),
};

describe('CookieUpdaterModal', () => {
    it('não renderiza quando isOpen é false', () => {
        const { container } = render(<CookieUpdaterModal {...defaultProps} isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('renderiza o modal quando isOpen é true', () => {
        render(<CookieUpdaterModal {...defaultProps} />);
        expect(screen.getByText(/sessão expirada/i)).toBeDefined();
    });

    it('renderiza o campo de input para o cookie SSID', () => {
        render(<CookieUpdaterModal {...defaultProps} />);
        expect(screen.getByLabelText(/novo cookie ssid/i)).toBeDefined();
    });

    it('chama onClose ao clicar em Cancelar', () => {
        const onClose = vi.fn();
        render(<CookieUpdaterModal {...defaultProps} onClose={onClose} />);
        fireEvent.click(screen.getByText(/cancelar/i));
        expect(onClose).toHaveBeenCalled();
    });

    it('chama onUpdate com o valor do SSID ao submeter', async () => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        render(<CookieUpdaterModal {...defaultProps} onUpdate={onUpdate} />);

        const input = screen.getByLabelText(/novo cookie ssid/i);
        fireEvent.change(input, { target: { value: 'meu-ssid-token' } });
        fireEvent.submit(input.closest('form'));

        await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('meu-ssid-token'));
    });

    it('mostra erro quando onUpdate rejeita', async () => {
        const onUpdate = vi.fn().mockRejectedValue(new Error('fail'));
        render(<CookieUpdaterModal {...defaultProps} onUpdate={onUpdate} />);

        const input = screen.getByLabelText(/novo cookie ssid/i);
        fireEvent.change(input, { target: { value: 'token' } });
        fireEvent.submit(input.closest('form'));

        await waitFor(() =>
            expect(screen.getByText(/falha ao atualizar/i)).toBeDefined()
        );
    });
});