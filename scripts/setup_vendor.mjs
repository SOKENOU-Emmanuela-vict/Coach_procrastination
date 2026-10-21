import fs from 'fs';
import path from 'path';

async function setup() {
    // 1. GSAP
    const gsapDir = path.resolve('vendor/gsap');
    if (!fs.existsSync(gsapDir)) fs.mkdirSync(gsapDir, { recursive: true });
    
    // 2. Bootstrap Icons local
    const biDir = path.resolve('vendor/bootstrap-icons');
    const fontsDir = path.join(biDir, 'fonts');
    if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
    
    console.log('Downloading bootstrap-icons.min.css...');
    const cssRes = await fetch('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.min.css');
    let cssText = await cssRes.text();
    cssText = cssText.replace(/url\([^)]*bootstrap-icons\.woff2[^)]*\)/g, 'url("./fonts/bootstrap-icons.woff2")');
    cssText = cssText.replace(/url\([^)]*bootstrap-icons\.woff[^)]*\)/g, 'url("./fonts/bootstrap-icons.woff")');
    fs.writeFileSync(path.join(biDir, 'bootstrap-icons.min.css'), cssText, 'utf-8');

    console.log('Downloading bootstrap-icons.woff2...');
    const woff2Res = await fetch('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/fonts/bootstrap-icons.woff2');
    const woff2Buf = await woff2Res.arrayBuffer();
    fs.writeFileSync(path.join(fontsDir, 'bootstrap-icons.woff2'), Buffer.from(woff2Buf));

    console.log('Vendor setup complete!');
}

setup().catch(console.error);
