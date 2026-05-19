import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { createRandomIterator } from './services/proxy/iterator.js';
import { getProxyList } from './services/proxy/provider.js';
import { getAccessToken } from './services/mercadolivre/auth.js';
import { searchProducts } from './services/mercadolivre/scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..'); // Root of the project

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const clientBuildPath = path.join(rootDir, 'client', 'dist');
app.use(express.static(clientBuildPath));


// Endpoint to update SSID Cookie
app.post('/api/settings/ssid', async (req, res) => {
    try {
        const { ssid } = req.body;
        if (!ssid) {
            return res.status(400).json({ error: 'SSID is required' });
        }

        // 1. Update In-Memory Config
        config.SID_COOKIE = ssid;
        process.env.SID_COOKIE = ssid;

        // 2. Persist to .env file
        const envPath = path.join(rootDir, '.env');
        let envContent = '';

        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Regex to find SID_COOKIE=...
        const regex = /^SID_COOKIE=.*$/m;
        const newLine = `SID_COOKIE=${ssid}`;

        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, newLine);
        } else {
            envContent += `\n${newLine}`;
        }

        fs.writeFileSync(envPath, envContent, 'utf8');

        res.json({ success: true, message: 'SSID updated successfully' });

    } catch (error) {
        console.error('❌ Error updating SSID:', error);
        res.status(500).json({ error: 'Failed to update SSID' });
    }
});

let proxyIterator = null;
let accessToken = null;

// Inicialização
async function initialize() {
    // 1. Configurar Proxies
    if (config.USE_PROXY) {
        try {
            const proxyListRaw = await getProxyList(config.WEBSHARE_TOKEN);
            console.log(proxyListRaw);
            const proxyList = proxyListRaw.map(
                obj => `${obj.proxy_address}:${obj.port}:${obj.username}:${obj.password}`
            );
            proxyIterator = createRandomIterator(proxyList);
        } catch (error) {
            console.error('❌ Erro ao carregar lista de proxies:', error);
        }
    }

    // 2. Autenticação Inicial
    try {
        accessToken = await getAccessToken();
        console.log(accessToken);
    } catch (error) {
        console.error('❌ Erro ao obter token de acesso inicial:', error);
    }

    // Renovar token a cada 20 minutos
    setInterval(async () => {
        accessToken = await getAccessToken();
    }, 20 * 60 * 1000);
}

// Endpoint de busca
app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Termo de pesquisa é obrigatório' });
        }

        const resultados = await searchProducts(query, proxyIterator, accessToken);

        // Adicionar o termo de pesquisa a cada resultado
        const resultadosComTermo = resultados.response.map(resultado => ({
            termo_pesquisa: query,
            ...resultado
        }));

        res.json(resultadosComTermo);

    } catch (error) {
        if (error.message === 'AUTH_EXPIRED') {
            console.error('⛔ Sessão expirada. Retornando 401 para o cliente.');
            return res.status(401).json({ code: 'AUTH_EXPIRED', error: 'Sessão do Mercado Livre expirada' });
        }
        console.error(`❌ Erro ao processar busca para "${req.body.query}":`, error);
        res.status(500).json({ error: 'Erro interno ao processar a busca' });
    }
});

app.get('/*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(port, async () => {
    await initialize();
    console.log(`Server is running on port ${port}`);
});

