# Origenow ML Cookie Sync — Extensão de Browser

Extensão Chrome/Firefox que monitora o cookie `ssid` do Mercado Livre e o envia automaticamente para o servidor local Origenow, eliminando a necessidade de copiar o cookie manualmente pelo DevTools.

## Como instalar (Chrome)

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `browser-extension/`

## Como instalar (Firefox)

1. Abra `about:debugging#/runtime/this-firefox`
2. Clique em **Carregar extensão temporária**
3. Selecione o arquivo `browser-extension/manifest.json`

## Como funciona

- Ao fazer login no Mercado Livre no browser, a extensão detecta o cookie `ssid` automaticamente e o envia para `http://localhost:3000/api/settings/ssid`
- Quando a sessão expira e o usuário faz login novamente, o cookie é sincronizado sem intervenção manual
- O popup da extensão mostra o status do último sync e permite configurar a URL do servidor

## Configuração

Por padrão a extensão aponta para `http://localhost:3000`. Para alterar, clique no ícone da extensão e edite o campo **URL do servidor**.