import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

const BRAND_TEAL = '#183d3d';
const BRAND_CREAM = '#fbf9f4';

function buildForegroundSvg(glyphScale = 12) {
    const size24 = 24 * glyphScale;
    const offset = Math.round((512 - size24) / 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(${offset}, ${offset}) scale(${glyphScale})" fill="none" stroke="${BRAND_CREAM}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
</svg>`;
}

function buildLegacyIconSvg(round = false) {
    const rx = round ? 256 : 112;
    const size24 = 24 * 16;
    const offset = Math.round((512 - size24) / 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${rx}" fill="${BRAND_TEAL}"/>
  <g transform="translate(${offset}, ${offset}) scale(16)" fill="none" stroke="${BRAND_CREAM}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
</svg>`;
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

async function renderSpecs(specs) {
    const chromePath = findChromeExecutable();
    if (!chromePath) throw new Error('Chromium requis pour rendre les icônes');
    const port = 9362;
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
                let d = '';
                resp.on('data', (c) => (d += c));
                resp.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
        const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

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
                    img.onerror = () => reject(new Error('SVG load error'));
                    img.src = 'data:image/svg+xml;base64,${svgB64}';
                })`
            });
            const dataUrl = evalRes.result.value;
            const buf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
            fs.mkdirSync(path.dirname(spec.dest), { recursive: true });
            fs.writeFileSync(spec.dest, buf);
            console.log(`✅ Android Icon: ${path.relative(ROOT_DIR, spec.dest)} (${spec.size}x${spec.size})`);
        }
        ws.close();
    } finally {
        try { chromeProcess.kill(); } catch (_) {}
    }
}

async function main() {
    if (!fs.existsSync(RES_DIR)) {
        console.error('Dossier android/app/src/main/res inexistant');
        process.exit(1);
    }

    const densities = [
        { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
        { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
        { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
        { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
        { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 }
    ];

    const fgSvg = buildForegroundSvg(11);
    const squareSvg = buildLegacyIconSvg(false);
    const roundSvg = buildLegacyIconSvg(true);

    const specs = [];
    for (const d of densities) {
        specs.push({
            dest: path.join(RES_DIR, d.dir, 'ic_launcher.png'),
            size: d.iconSize,
            svg: squareSvg
        });
        specs.push({
            dest: path.join(RES_DIR, d.dir, 'ic_launcher_round.png'),
            size: d.iconSize,
            svg: roundSvg
        });
        specs.push({
            dest: path.join(RES_DIR, d.dir, 'ic_launcher_foreground.png'),
            size: d.fgSize,
            svg: fgSvg
        });
    }

    await renderSpecs(specs);
    console.log('🎉 Toutes les icônes Android natives ont été générées avec succès !');
}

main().catch((err) => {
    console.error('Erreur:', err);
    process.exit(1);
});
