# Origenow Analytics 🚀

Um sistema avançado de inteligência competitiva para Mercado Livre, focado em análise massiva de anúncios, cálculo de TTS (Time-to-Sell) e identificação de oportunidades de mercado.

![Origenow Analytics](/client/public/logo-origenow.png)

## ✨ Funcionalidades Principais

### 🔍 Busca & Análise
- **Busca em Massa**: Insira múltiplos códigos (SKU, ASIN, Termos) de uma vez. O sistema identifica automaticamente o tipo de entrada.
- **Cálculo de TTS (Time-to-Sell)**: Algoritmo proprietário que estima o tempo médio em horas para realizar uma venda, baseado no histórico do anúncio.
- **Smart Sales Detection**: Identifica se o volume de vendas é real (scraped) ou derivado, escolhendo sempre o dado mais assertivo.

### 📊 Dashboard & Métricas
- **Bento Grid**: Visualização moderna dos KPIs principais (Itens Analisados, Média de TTS, Volume de Vendas).
- **Legenda Inteligente**: Explica visualmente os métodos de cálculo ("Individual" vs "Média de Catálogo").
- **Badges de Status**:
  - 🟢 **Oportunidade**: Baixa concorrência e alto giro.
  - 🔴 **Produto Arriscado**: Alta variação em relação à média do catálogo.
  - 🔵 **1P / Loja Oficial**: Identifica vendedores oficiais.
  - ⚡ **Full**: Produtos no Fulfillment.

### 🛡️ Segurança & Confiabilidade
- **Gestão de Sessão**:
  - **Detecção Automática de Expiração**: Se o cookie do ML expirar, o sistema avisa.
  - **Modal de Atualização**: Interface amigável para inserir um novo cookie sem mexer em código.
- **Validação de Ambiente**: O servidor não inicia se as variáveis críticas (`AVANTPRO_TOKEN`, etc.) não estiverem configuradas.

### 📤 Exportação
- **Excel Premium**: Exportação profissional em `.xlsx` com cabeçalhos formatados, negrito e colunas ajustadas automaticamente.
- **Dados Completos**: Inclui ID, Título, Preço, Vendedor, Cidade, Estado, Vendas, TTS, Velocidade, Taxas e Links.

### 🎨 UI / UX
- **Design System Origenow**: Gradientes violeta/roxo, fontes modernas (Quicksand) e componentes arredondados.
- **Loader Personalizado**: Animação exclusiva de carregamento para melhor experiência de espera.
- **Responsividade**: Totalmente adaptado para desktop e mobile.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18 ou superior)
- NPM ou Yarn
- Cookie de Sessão do Mercado Livre (`ssid`)

### 1. Instalação
Clone o repositório e instale as dependências:

```bash
# Instalar dependências da raiz (backend)
npm install

# Instalar dependências do cliente (frontend)
cd client
npm install
cd ..
```

### 2. Configuração (.env)
Crie um arquivo `.env` na raiz do projeto com as seguintes chaves:

```env
AVANTPRO_TOKEN=seu_token_aqui
MELI_CLIENT_ID=seu_client_id
MELI_CLIENT_SECRET=seu_client_secret
SID_COOKIE=seu_cookie_ssid_do_ml
PORT=3000
```

> **Nota**: O `SID_COOKIE` é essencial para a busca funcionar. Se ele expirar, use o modal na interface para atualizar.

### 3. Execução
Você precisará de **dois terminais** abertos:

**Terminal 1 (Backend API):**
```bash
# Na raiz do projeto
npm run server
```
*O servidor rodará em http://localhost:3000*

**Terminal 2 (Frontend Interface):**
```bash
cd client
npm run dev
```
*A interface abrirá em http://localhost:5173*

---

## 🛠️ Detalhes Técnicos

### Backend (`src/`)
- **Express**: Servidor API REST.
- **Puppeteer/Cheerio**: Scrapers redundantes para garantir a captura de dados mesmo com mudanças no layout do ML.
- **FileSystem (fs)**: Persistência segura de configurações.

### Frontend (`client/`)
- **React + Vite**: Performance e HMR instantâneo.
- **Tailwind CSS**: Estilização utility-first com design system customizado.
- **XLSX-JS-Style**: Geração de planilhas complexas no navegador.

---

## 📝 Créditos

Desenvolvido por **Pedro Borela**.
© 2026 Origenow Analytics. Todos os direitos reservados.
