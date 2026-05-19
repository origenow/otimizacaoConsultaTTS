import fetch from "node-fetch";
import https from 'node:https';
import * as cheerio from 'cheerio';
import { config } from '../../config/index.js';

export async function getAccessToken() {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", "client_credentials");
    urlencoded.append("client_id", config.MELI_CLIENT_ID);
    urlencoded.append("client_secret", config.MELI_CLIENT_SECRET);

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow"
    };

    return fetch("https://api.mercadolibre.com/oauth/token", requestOptions)
        .then((response) => response.json())
        .then((result) => result.access_token)
        .catch((error) => console.error(error));
}

export async function getAuthHeaders(proxyIterator) {
    let agent;

    // Seleciona um proxy aleatório se USE_PROXY estiver ativo
    if (config.USE_PROXY && proxyIterator) {
        const proxy = proxyIterator.next();
        const [host, port, user, pass] = proxy.split(':');
        const proxyUrl = `http://${user}:${pass}@${host}:${port}`;
        agent = new https.Agent({ proxy: proxyUrl });
    }

    let tokens = {};

    try {
        const fetchOptions = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
                'Host': 'www.mercadolivre.com.br',
                'Connection': 'keep-alive',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        if (agent) {
            fetchOptions.agent = agent;
        }

        const response = await fetch('https://www.mercadolivre.com.br/', fetchOptions);

        const cookies = response.headers.get('set-cookie') || '';
        let csrfToken, d2id;

        cookies.split(',').forEach(cookie => {
            if (cookie.includes('_csrf')) {
                csrfToken = (/_csrf=([^;]+)/.exec(cookie) || [])[1];
            }
            if (cookie.includes('_d2id')) {
                d2id = (/_d2id=([^;]+)/.exec(cookie) || [])[1];
            }
        });

        tokens.csrf = csrfToken;
        tokens.d2id = d2id;

        const html = await response.text();
        const $ = cheerio.load(html);
        const xsrf = $('meta[name="csrf-token"]').attr('content');
        if (xsrf) {
            tokens.xsrf = xsrf;
        }
    } catch (error) {
        console.error('Erro ao realizar a requisição:', error);
    }

    return tokens;
}
