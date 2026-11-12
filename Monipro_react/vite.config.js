import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Front estático original. Enquanto a migração não termina, as telas que ainda não viraram
// React (e JS/config.js, IMG/, CSS/, fonts/) continuam saindo de lá, nas mesmas URLs.
const LEGADO = fileURLToPath(new URL('../Monipro_web/', import.meta.url));

// Uma entrada HTML por tela (sem roteador): cada tela mantém a URL .html de hoje e só carrega
// o próprio CSS, que no original é global (reset em "*", ids e classes repetidos entre telas).
// Toda *.html na raiz de Monipro_react é uma tela migrada; não é preciso registrar nada aqui.
const RAIZ = fileURLToPath(new URL('./', import.meta.url));
const ENTRADAS = fs.readdirSync(RAIZ).filter((nome) => nome.endsWith('.html'));

// Telas já migradas: quem responde por elas é o React, não o arquivo de Monipro_web.
const MIGRADAS = ENTRADAS.map((nome) => `/${nome}`);

const TIPOS = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.woff2': 'font/woff2'
};

// Só para "npm run dev" e "npm run preview": o que existir em Monipro_web é servido como o
// Nginx serve hoje. Em produção quem junta as duas pastas é a imagem do frontend.
function telasLegadas() {
    const servir = (req, res, next) => {
        const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (MIGRADAS.includes(caminho)) return next();

        // Mesmo papel do envsubst do Nginx sobre JS/config.js.template (a variável aparece
        // mais de uma vez no arquivo: no comentário e no valor)
        if (caminho === '/JS/config.js' && process.env.API_BASE_URL) {
            const modelo = fs.readFileSync(path.join(LEGADO, 'JS/config.js.template'), 'utf8');
            res.setHeader('Content-Type', TIPOS['.js']);
            res.end(modelo.replaceAll('${API_BASE_URL}', process.env.API_BASE_URL));
            return;
        }

        const arquivo = path.join(LEGADO, caminho);
        const tipo = TIPOS[path.extname(arquivo)];
        if (!tipo || !arquivo.startsWith(LEGADO) || !fs.existsSync(arquivo)) return next();

        res.setHeader('Content-Type', tipo);
        fs.createReadStream(arquivo).pipe(res);
    };

    return {
        name: 'monipro-telas-legadas',
        configureServer(server) {
            server.middlewares.use(servir);
        },
        configurePreviewServer(server) {
            server.middlewares.use(servir);
        }
    };
}

export default defineConfig({
    plugins: [react(), telasLegadas()],
    // As telas migradas importam o CSS e as imagens originais de ../Monipro_web
    server: { fs: { allow: ['.', LEGADO] } },
    // Sem isto o minificador reescreve o CSS original em sintaxe mais nova (ex.:
    // "@media (max-width: 900px)" vira "(width<=900px)", que Safari < 16.4 ignora).
    // O piso abaixo é o que o JS de Monipro_web já exige hoje ("?." e "??").
    // cssMinify: false mantém o CSS de Monipro_web byte a byte como o original. Minificado, o
    // gradiente do body (base.css) era reescrito e saía 1-2 níveis de cor diferente, e o build
    // acrescentava -webkit-backdrop-filter que o original não tem. Custo: ~7 KB gzip no total.
    build: {
        cssMinify: false,
        cssTarget: ['chrome80', 'firefox74', 'safari13.1'],
        rollupOptions: {
            input: Object.fromEntries(
                ENTRADAS.map((nome) => [path.basename(nome, '.html'), path.join(RAIZ, nome)])
            )
        }
    }
});
