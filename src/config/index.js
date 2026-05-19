import 'dotenv/config';

export const config = {
    CEP: process.env.CEP || "36900040",
    USE_PROXY: process.env.USE_PROXY === 'true',

    // Webshare
    WEBSHARE_TOKEN: process.env.WEBSHARE_TOKEN,

    // Mercado Livre API
    MELI_CLIENT_ID: process.env.MELI_CLIENT_ID,
    MELI_CLIENT_SECRET: process.env.MELI_CLIENT_SECRET,

    // Session
    SID_COOKIE: process.env.SID_COOKIE,

    // Constants
    RETRY_COUNT: 3
};
