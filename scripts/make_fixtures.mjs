import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');
const require = createRequire(import.meta.url);

fs.mkdirSync(FIXTURES_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Générateur PDF 1.4 autonome (table xref exacte en octets)
// ---------------------------------------------------------------------------
function escapePdfText(str) {
    return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfBuffer(pageContents) {
    const objects = [];
    // 1: Catalog, 2: Pages, 3: Font
    const pageObjIds = [];
    let nextId = 4;
    for (let i = 0; i < pageContents.length; i++) {
        const pageId = nextId++;
        const contentId = nextId++;
        pageObjIds.push({ pageId, contentId, stream: pageContents[i] });
    }

    objects.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' });
    const kidsRef = pageObjIds.map(p => `${p.pageId} 0 R`).join(' ');
    objects.push({ id: 2, body: `<< /Type /Pages /Kids [${kidsRef}] /Count ${pageObjIds.length} >>` });
    objects.push({ id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' });

    for (const p of pageObjIds) {
        objects.push({
            id: p.pageId,
            body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${p.contentId} 0 R >>`
        });
        const streamBytes = Buffer.byteLength(p.stream, 'latin1');
        objects.push({
            id: p.contentId,
            body: `<< /Length ${streamBytes} >>\nstream\n${p.stream}\nendstream`
        });
    }

    objects.sort((a, b) => a.id - b.id);

    const chunks = [];
    let offset = 0;
    const pushStr = (s) => {
        const buf = Buffer.from(s, 'latin1');
        chunks.push(buf);
        offset += buf.length;
    };

    pushStr('%PDF-1.4\n');
    const offsets = [0]; // index 0 = free object
    for (const obj of objects) {
        offsets[obj.id] = offset;
        pushStr(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
    }

    const xrefOffset = offset;
    const totalObjs = objects.length + 1;
    let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
    for (let i = 1; i < totalObjs; i++) {
        xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    pushStr(xref);

    return Buffer.concat(chunks);
}

const page1Stream = [
    'BT',
    '/F1 12 Tf',
    '50 760 Td',
    `(${escapePdfText('MTH1321 Structures algebriques et applications - Page 1')}) Tj`,
    '0 -24 Td',
    `(${escapePdfText('Chapitre 1 : Groupes, sous-groupes distingués, théorème de Lagrange et morphismes.')}) Tj`,
    'ET'
].join('\n');

const page2Stream = [
    'BT',
    '/F1 12 Tf',
    '50 760 Td',
    `(${escapePdfText('MTH1321 Structures algebriques et applications - Page 2')}) Tj`,
    '0 -24 Td',
    `(${escapePdfText('Chapitre 2 : Anneaux, idéaux premiers et mot distinctif MORPHISME_NOYAU_P2 pour vérification.')}) Tj`,
    'ET'
].join('\n');

const pdf2PagesPath = path.join(FIXTURES_DIR, 'cours_2pages.pdf');
fs.writeFileSync(pdf2PagesPath, buildPdfBuffer([page1Stream, page2Stream]));

const scanBlankStream = 'q\n200 0 0 200 100 500 cm\n0.9 g\n0 0 1 1 re\nf\nQ';
const scanPdfPath = path.join(FIXTURES_DIR, 'scan_sans_texte.pdf');
fs.writeFileSync(scanPdfPath, buildPdfBuffer([scanBlankStream]));

// ---------------------------------------------------------------------------
// 2. Générateur ZIP / OOXML .docx autonome (sans dépendance npm)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZipBuffer(entries) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
        const compressed = zlib.deflateRawSync(rawBuf);
        const crc = crc32(rawBuf);

        const localHeader = Buffer.alloc(30 + nameBuf.length);
        localHeader.writeUInt32LE(0x04034b50, 0); // signature
        localHeader.writeUInt16LE(20, 4);         // version needed
        localHeader.writeUInt16LE(0, 6);          // flags
        localHeader.writeUInt16LE(8, 8);          // method: deflate
        localHeader.writeUInt16LE(0x4000, 10);    // fixed mod time (deterministic)
        localHeader.writeUInt16LE(0x5559, 12);    // fixed mod date (deterministic)
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(compressed.length, 18);
        localHeader.writeUInt32LE(rawBuf.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);
        nameBuf.copy(localHeader, 30);

        localParts.push(localHeader, compressed);

        const centralHeader = Buffer.alloc(46 + nameBuf.length);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(8, 10);
        centralHeader.writeUInt16LE(0x4000, 12);
        centralHeader.writeUInt16LE(0x5559, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(compressed.length, 20);
        centralHeader.writeUInt32LE(rawBuf.length, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(localOffset, 42);
        nameBuf.copy(centralHeader, 46);

        centralParts.push(centralHeader);
        localOffset += localHeader.length + compressed.length;
    }

    const centralDirBuf = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralDirBuf.length, 12);
    eocd.writeUInt32LE(localOffset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildDocxBuffer(paragraphs) {
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const bodyXml = paragraphs
        .map(p => `<w:p><w:r><w:t>${escapeXml(p)}</w:t></w:r></w:p>`)
        .join('');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;

    return buildZipBuffer([
        { name: '[Content_Types].xml', data: contentTypesXml },
        { name: '_rels/.rels', data: relsXml },
        { name: 'word/document.xml', data: documentXml }
    ]);
}

const docxPath = path.join(FIXTURES_DIR, 'cours_poo.docx');
fs.writeFileSync(docxPath, buildDocxBuffer([
    'INF1322 — Approche orientée objet (Java/C++)',
    'Encapsulation, classes abstraites, interfaces et mot distinctif POLYMORPHISME_HERITAGE_DOCX.',
    'Lundi 08h00 - 10h00 : Approche orientée objet (Java/C++)',
    'Mardi 10h00 - 12h00 : Structures algébriques et applications'
]));

// ---------------------------------------------------------------------------
// 3. Emploi du temps .csv et .xlsx (via vendor/sheetjs/xlsx.mini.min.js)
// ---------------------------------------------------------------------------
const scheduleRows = [
    ['Jour', 'Début', 'Fin', 'Matière', 'Code', 'Groupe', 'Salle'],
    ['Lundi', '08:00', '10:00', 'Structures algébriques et applications', 'MTH1321', 'Groupe 2', 'Amphi A'],
    ['Mardi', '10:00', '12:00', 'Approche orientée objet (Java/C++)', 'INF1322', 'Groupe 2', 'Salle TP 2'],
    ['Jeudi', '14:00', '16:00', 'Structures algébriques et applications', 'MTH1321', 'Groupe 1', 'Salle B1']
];

const csvContent = scheduleRows.map(row => row.join(';')).join('\n') + '\n';
const csvPath = path.join(FIXTURES_DIR, 'emploi_du_temps.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');

const XLSX = require(path.join(ROOT_DIR, 'vendor', 'sheetjs', 'xlsx.mini.min.js'));
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(scheduleRows);
XLSX.utils.book_append_sheet(wb, ws, 'EmploiDuTemps');
const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const xlsxPath = path.join(FIXTURES_DIR, 'emploi_du_temps.xlsx');
fs.writeFileSync(xlsxPath, xlsxBuf);

for (const file of fs.readdirSync(FIXTURES_DIR).sort()) {
    const full = path.join(FIXTURES_DIR, file);
    console.log(`Fixture générée : tests/fixtures/${file} (${fs.statSync(full).size} octets)`);
}
