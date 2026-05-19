export function createRandomIterator(array, interval = 30) {
    let lastUsed = {}; // Objeto para armazenar os índices usados e os tempos de uso

    return {
        next: function () {
            const now = Date.now();
            let randomIndex;
            let attempts = 0;

            // Tenta encontrar um item que possa ser usado
            do {
                // Math.random() is intentional here: proxy rotation does not require cryptographic randomness
                randomIndex = Math.floor(Math.random() * array.length); // NOSONAR

                // Verifica se o item foi utilizado recentemente e se já passou o tempo de espera
                if (!lastUsed[randomIndex] || now - lastUsed[randomIndex] >= interval) {
                    break; // Sai do loop se o item pode ser utilizado
                }

                attempts++; // Conta quantas tentativas foram feitas
            } while (attempts < array.length); // Evita um loop infinito caso todos os itens estejam bloqueados

            // Atualiza o tempo de uso para o índice selecionado
            lastUsed[randomIndex] = now;

            return array[randomIndex];
        },
    };
}
