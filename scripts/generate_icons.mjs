import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT_DIR, 'assets', 'icons');

const BRAND_TEAL = '#183d3d'; // --accent-primary (univers-ecole)
const BRAND_CREAM = '#fbf9f4'; // --bg-page (univers-ecole)

/**
 * Construit le SVG officiel de Learning OS (Toque Académique).
 * Deux couleurs plates uniquement (#183d3d et #fbf9f4), zéro dégradé ni ombre.
 * @param {object} opts
 * @param {boolean} opts.fullBleed - True pour maskable Android & apple-touch-icon (fond carré plein bord).
 * @param {number} opts.glyphScale - Échelle du glyphe 24x24 (16 pour normal, ~14.5 pour maskable safe-zone).
 */
export function buildAppIconSvg({ fullBleed = false, glyphScale = 16 } = {}) {
    const rx = fullBleed ? 0 : 112;
    const size24 = 24 * glyphScale;
    const offset = Math.round((512 - size24) / 2);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${rx}" fill="${BRAND_TEAL}"/>
  <g transform="translate(${offset}, ${offset}) scale(${glyphScale})" fill="none" stroke="${BRAND_CREAM}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
</svg>
`;
}

function findChromeExecutable() {
    const candidates = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe')
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(c)) return c;
    }
    return null;
}

function readPngDimensions(buffer) {
    // Signature PNG + chunk IHDR (offset 16 = width BE, offset 20 = height BE)
    if (buffer.length < 24) throw new Error('PNG invalide (trop court)');
    const sig = buffer.subarray(0, 8).toString('hex');
    if (sig !== '89504e470d0a1a0a') throw new Error('Signature PNG invalide');
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}

async function renderSvgsToPngs(specs) {
    const chromePath = findChromeExecutable();
    if (!chromePath) {
        throw new Error('Aucun navigateur Chromium/Edge détecté pour convertir les SVG en PNG.');
    }

    const port = 9345;
    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=600,600'
    ]);

    await new Promise((r) => setTimeout(r, 1500));

    try {
        const targets = await new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${port}/json`, (resp) => {
                let data = '';
                resp.on('data', (c) => (data += c));
                resp.on('end', () => res(JSON.parse(data)));
            }).on('error', rej);
        });

        const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.onopen = res;
            ws.onerror = rej;
        });

        let msgId = 1;
        const send = (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = msgId++;
                const handler = (e) => {
                    const data = JSON.parse(e.data);
                    if (data.id === id) {
                        ws.removeEventListener('message', handler);
                        if (data.error) reject(new Error(data.error.message));
                        else resolve(data.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
            });

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: 'about:blank' });

        for (const spec of specs) {
            const svgB64 = Buffer.from(spec.svg, 'utf8').toString('base64');
            const evalRes = await send('Runtime.evaluate', {
                awaitPromise: true,
                returnByValue: true,
                expression: `new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = ${spec.size};
                        canvas.height = ${spec.size};
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, ${spec.size}, ${spec.size});
                        ctx.drawImage(img, 0, 0, ${spec.size}, ${spec.size});
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = () => reject(new Error('SVG load error for ${spec.filename}'));
                    img.src = 'data:image/svg+xml;base64,${svgB64}';
                })`
            });

            if (evalRes.exceptionDetails) {
                throw new Error(`Erreur rendu ${spec.filename}: ${JSON.stringify(evalRes.exceptionDetails)}`);
            }

            const dataUrl = evalRes.result.value;
            const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
            const buf = Buffer.from(base64, 'base64');
            const dims = readPngDimensions(buf);
            if (dims.width !== spec.size || dims.height !== spec.size) {
                throw new Error(`Dimensions incorrectes pour ${spec.filename}: ${dims.width}x${dims.height} attendu ${spec.size}x${spec.size}`);
            }

            const dest = path.join(OUT_DIR, spec.filename);
            fs.writeFileSync(dest, buf);
            console.log(`✅ Généré ${path.relative(ROOT_DIR, dest)} (${dims.width}x${dims.height}, ${buf.length} octets)`);
        }

        ws.close();
    } finally {
        try {
            chromeProcess.kill();
        } catch (_) {}
    }
}

async function main() {
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const standardSvg = buildAppIconSvg({ fullBleed: false, glyphScale: 16 });
    // Pour maskable Android (cercle 80%), on réduit légèrement le glyphe (scale 14) pour marge de sécurité confortable
    const maskableSvg = buildAppIconSvg({ fullBleed: true, glyphScale: 14 });
    const appleSvg = buildAppIconSvg({ fullBleed: true, glyphScale: 15.5 });

    // Enregistre aussi le SVG canonique
    const svgPath = path.join(OUT_DIR, 'icon.svg');
    fs.writeFileSync(svgPath, standardSvg, 'utf8');
    console.log(`✅ Généré ${path.relative(ROOT_DIR, svgPath)}`);

    const specs = [
        { filename: 'favicon-48.png', size: 48, svg: standardSvg },
        { filename: 'apple-touch-icon.png', size: 180, svg: appleSvg },
        { filename: 'icon-192.png', size: 192, svg: standardSvg },
        { filename: 'icon-512.png', size: 512, svg: standardSvg },
        { filename: 'icon-maskable-192.png', size: 192, svg: maskableSvg },
        { filename: 'icon-maskable-512.png', size: 512, svg: maskableSvg }
    ];

    await renderSvgsToPngs(specs);
}

main().catch((err) => {
    console.error('❌ Échec génération des icônes :', err);
    process.exit(1);
});
