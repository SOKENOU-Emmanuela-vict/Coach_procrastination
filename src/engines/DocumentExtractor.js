/**
 * DocumentExtractor
 * Responsabilité : Extraire le texte brut et paginé depuis une source
 * (texte brut, fichier .txt, .md, PDF via pdf.js, .docx via mammoth).
 * Gère le fallback Gemini pour les PDF/images scannés sans couche texte.
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 Mo
const _scriptPromises = new Map();

function loadVendorScript(src, resolveGlobal) {
    const existing = resolveGlobal();
    if (existing) return Promise.resolve(existing);
    if (_scriptPromises.has(src)) return _scriptPromises.get(src);

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            const loaded = resolveGlobal();
            if (loaded) resolve(loaded);
            else reject(new Error(`Bibliothèque non exposée après chargement de ${src}`));
        };
        script.onerror = () => {
            _scriptPromises.delete(src);
            reject(new Error(`Échec du chargement de ${src}`));
        };
        document.head.appendChild(script);
    });

    _scriptPromises.set(src, promise);
    return promise;
}

async function getPdfJs() {
    if (typeof globalThis !== 'undefined' && globalThis.pdfjsLib) {
        return globalThis.pdfjsLib;
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
            const lib = await loadVendorScript(
                './vendor/pdfjs/pdf.min.js',
                () => window.pdfjsLib || window['pdfjs-dist/build/pdf']
            );
            if (lib && lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
                lib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js';
            }
            return lib;
        } catch (e) {
            throw new Error("Bibliothèque PDF.js indisponible.");
        }
    }
    try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        if (!globalThis.DOMMatrix) globalThis.DOMMatrix = class DOMMatrix {};
        if (!globalThis.Path2D) globalThis.Path2D = class Path2D {};
        if (!globalThis.pdfjsWorker) {
            globalThis.pdfjsWorker = require('../../vendor/pdfjs/pdf.worker.min.js');
        }
        const lib = require('../../vendor/pdfjs/pdf.min.js');
        globalThis.pdfjsLib = lib;
        return lib;
    } catch (e) {
        throw new Error("Bibliothèque PDF.js indisponible.");
    }
}

async function getMammoth() {
    if (typeof globalThis !== 'undefined' && globalThis.mammoth) {
        return globalThis.mammoth;
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
            return await loadVendorScript(
                './vendor/mammoth/mammoth.browser.min.js',
                () => window.mammoth
            );
        } catch (e) {
            throw new Error("Bibliothèque Mammoth indisponible.");
        }
    }
    try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const lib = require('../../vendor/mammoth/mammoth.browser.min.js');
        globalThis.mammoth = lib;
        return lib;
    } catch (e) {
        throw new Error("Bibliothèque Mammoth indisponible.");
    }
}

export class DocumentExtractor {
    /**
     * Calcule l'empreinte sha256 simplifiée d'un buffer ou chaîne
     * @param {ArrayBuffer|Uint8Array|string} bufferOrStr
     * @returns {Promise<string>}
     */
    static async computeFingerprint(bufferOrStr) {
        try {
            if (typeof crypto !== 'undefined' && crypto.subtle) {
                let bytes;
                if (typeof bufferOrStr === 'string') {
                    bytes = new TextEncoder().encode(bufferOrStr);
                } else if (bufferOrStr instanceof Uint8Array) {
                    bytes = bufferOrStr;
                } else if (bufferOrStr instanceof ArrayBuffer) {
                    bytes = new Uint8Array(bufferOrStr);
                } else if (bufferOrStr && bufferOrStr.buffer) {
                    bytes = new Uint8Array(bufferOrStr.buffer);
                }
                if (bytes) {
                    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
                }
            }
        } catch (_) {}
        // Fallback déterministe simple
        const str = typeof bufferOrStr === 'string' ? bufferOrStr : (bufferOrStr ? bufferOrStr.length : '0');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'fp_' + Math.abs(hash).toString(16);
    }

    /**
     * Détermine le type de fichier selon son nom et/ou mimeType
     */
    static detectFormat(source) {
        if (!source) return null;
        if (typeof source === 'string') return 'text';

        const name = (source.name || '').toLowerCase();
        const type = (source.type || '').toLowerCase();

        if (name.endsWith('.pdf') || type.includes('pdf')) return 'pdf';
        if (name.endsWith('.docx') || type.includes('wordprocessingml') || type.includes('docx')) return 'docx';
        if (name.endsWith('.txt') || name.endsWith('.md') || type.includes('text/plain') || type.includes('text/markdown')) return 'text_file';
        if (type.startsWith('image/')) return 'image';

        return null;
    }

    /**
     * Extrait le texte d'une source
     * @param {string|File|Blob|Object} source - Le contenu brut ou le fichier
     * @param {Object} options - Options (detailed, llmProvider)
     * @returns {Promise<string|{text: string, pages: Array<{pageNumber: number, text: string}>, pageCount: number, fingerprint: string}>}
     */
    static async extractText(source, options = {}) {
        // 1. Cas d'une simple chaîne passée directement
        if (typeof source === 'string') {
            const trimmed = source.trim();
            if (trimmed.length === 0) {
                throw new Error("Le fichier est vide.");
            }
            if (options && options.detailed) {
                return {
                    text: source,
                    pages: [{ pageNumber: 1, text: source }],
                    pageCount: 1,
                    fingerprint: await this.computeFingerprint(source)
                };
            }
            return source;
        }

        if (!source || typeof source !== 'object') {
            throw new Error("Format de source non supporté.");
        }

        // 2. Vérification de la taille
        const size = typeof source.size === 'number' ? source.size : (source.data ? source.data.length || source.data.byteLength : null);
        if (size !== null && size !== undefined) {
            if (size === 0) {
                throw new Error("Le fichier est vide.");
            }
            if (size > MAX_FILE_SIZE) {
                throw new Error("Le fichier dépasse la limite autorisée de 15 Mo.");
            }
        }

        // 3. Détection du format
        const format = this.detectFormat(source);
        if (!format) {
            throw new Error("Format de fichier non pris en charge. Formats acceptés : PDF, Word (.docx), texte (.txt, .md).");
        }

        // 4. Extraction selon le format
        if (format === 'text_file') {
            return await this._extractTextFile(source, options);
        }

        if (format === 'docx') {
            return await this._extractDocx(source, options);
        }

        if (format === 'pdf') {
            return await this._extractPdf(source, options);
        }

        if (format === 'image') {
            return await this._extractScannedOrImage(source, 'image', options);
        }

        throw new Error("Format de fichier non pris en charge. Formats acceptés : PDF, Word (.docx), texte (.txt, .md).");
    }

    /**
     * Lecture d'un fichier .txt ou .md
     */
    static async _extractTextFile(source, options) {
        let text = '';
        let rawBuffer = null;

        if (typeof source.text === 'function') {
            text = await source.text();
        } else if (typeof source.content === 'string') {
            text = source.content;
        } else if (source.data) {
            rawBuffer = source.data;
            if (typeof rawBuffer === 'string') {
                text = rawBuffer;
            } else {
                text = new TextDecoder('utf-8').decode(rawBuffer);
            }
        } else if (typeof source.text === 'string') {
            text = source.text;
        }

        if (!text || text.trim().length === 0) {
            throw new Error("Le fichier est vide.");
        }

        const fingerprint = await this.computeFingerprint(rawBuffer || text);

        if (options && options.detailed) {
            return {
                text,
                pages: [{ pageNumber: 1, text }],
                pageCount: 1,
                fingerprint
            };
        }
        return text;
    }

    /**
     * Lecture d'un fichier .docx via mammoth
     */
    static async _extractDocx(source, options) {
        let arrayBuffer = null;

        if (typeof source.arrayBuffer === 'function') {
            arrayBuffer = await source.arrayBuffer();
        } else if (source.data instanceof ArrayBuffer) {
            arrayBuffer = source.data;
        } else if (source.data && source.data.buffer instanceof ArrayBuffer) {
            arrayBuffer = source.data.buffer.slice(source.data.byteOffset, source.data.byteOffset + source.data.byteLength);
        } else if (source.buffer instanceof ArrayBuffer) {
            arrayBuffer = source.buffer;
        } else if (source.buffer && source.buffer.buffer instanceof ArrayBuffer) {
            arrayBuffer = source.buffer.buffer.slice(source.buffer.byteOffset, source.buffer.byteOffset + source.buffer.byteLength);
        }

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error("Le fichier est vide.");
        }

        const mammoth = await getMammoth();
        let result;
        try {
            // mammoth.browser.min.js lit { arrayBuffer } aussi bien dans le navigateur que sous Node
            result = await mammoth.extractRawText({ arrayBuffer });
        } catch (firstErr) {
            if (typeof Buffer !== 'undefined' && /Could not find file in options/i.test(firstErr.message || '')) {
                try {
                    result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
                } catch (e) {
                    throw new Error("Impossible de lire ce document Word (.docx) : " + (e.message || "fichier endommagé"));
                }
            } else {
                throw new Error("Impossible de lire ce document Word (.docx) : " + (firstErr.message || "fichier endommagé"));
            }
        }

        const extractedText = (result && result.value ? result.value : '').trim();
        if (!extractedText) {
            throw new Error("Le fichier est vide.");
        }

        const fingerprint = await this.computeFingerprint(arrayBuffer);

        if (options && options.detailed) {
            return {
                text: extractedText,
                pages: [{ pageNumber: 1, text: extractedText }],
                pageCount: 1,
                fingerprint
            };
        }
        return extractedText;
    }

    /**
     * Lecture d'un fichier PDF via pdf.js
     */
    static async _extractPdf(source, options) {
        let uint8Array = null;
        let arrayBuffer = null;

        if (typeof source.arrayBuffer === 'function') {
            arrayBuffer = await source.arrayBuffer();
            uint8Array = new Uint8Array(arrayBuffer);
        } else if (source.data instanceof Uint8Array) {
            uint8Array = source.data;
            arrayBuffer = uint8Array.buffer;
        } else if (source.data instanceof ArrayBuffer) {
            arrayBuffer = source.data;
            uint8Array = new Uint8Array(arrayBuffer);
        } else if (source.data && source.data.buffer instanceof ArrayBuffer) {
            uint8Array = new Uint8Array(source.data.buffer, source.data.byteOffset, source.data.byteLength);
            arrayBuffer = source.data.buffer;
        }

        if (!uint8Array || uint8Array.byteLength === 0) {
            throw new Error("Le fichier est vide.");
        }

        const pdfjsLib = await getPdfJs();
        if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            if (typeof window !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
            }
        }

        let pdfDoc;
        try {
            const loadingTask = pdfjsLib.getDocument({
                data: uint8Array,
                isEvalSupported: false,
                useSystemFonts: true
            });
            pdfDoc = await loadingTask.promise;
        } catch (err) {
            if (err && (err.name === 'PasswordException' || /password/i.test(err.message || ''))) {
                throw new Error("Ce fichier est protégé par un mot de passe et ne peut pas être lu.");
            }
            throw new Error("Erreur de lecture PDF : " + (err.message || "fichier non valide"));
        }

        const pages = [];
        let fullText = '';

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();
            const pageStr = content.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
            if (pageStr.length > 0) {
                pages.push({ pageNumber: i, text: pageStr });
                fullText += (fullText ? '\n\n' : '') + pageStr;
            }
        }

        // Si aucun texte n'a pu être extrait du PDF (PDF scanné / image)
        if (!fullText.trim()) {
            return await this._extractScannedOrImage(source, 'application/pdf', options, uint8Array);
        }

        const fingerprint = await this.computeFingerprint(uint8Array);

        if (options && options.detailed) {
            return {
                text: fullText,
                pages,
                pageCount: pdfDoc.numPages,
                fingerprint
            };
        }
        return fullText;
    }

    /**
     * Fallback pour PDF scanné (image) ou photo : passe par Gemini si configuré, sinon erreur claire
     */
    static async _extractScannedOrImage(source, mimeType, options, rawBytes = null) {
        const llmProvider = options.llmProvider || (source && source.llmProvider);
        const hasGeminiKey = !!(llmProvider && (llmProvider.apiKey || (typeof llmProvider.hasKey === 'function' && llmProvider.hasKey())));

        if (!hasGeminiKey || !llmProvider || typeof llmProvider.generateFromFile !== 'function') {
            throw new Error("Ce PDF est une image : ajoute une clé Gemini pour le lire, ou colle le texte.");
        }

        // Conversion en base64
        let base64 = '';
        if (source.base64) {
            base64 = source.base64;
        } else if (rawBytes) {
            if (typeof Buffer !== 'undefined') {
                base64 = Buffer.from(rawBytes).toString('base64');
            } else {
                let binary = '';
                const bytes = new Uint8Array(rawBytes);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                base64 = btoa(binary);
            }
        } else if (typeof source.arrayBuffer === 'function') {
            const buf = await source.arrayBuffer();
            const bytes = new Uint8Array(buf);
            if (typeof Buffer !== 'undefined') {
                base64 = Buffer.from(bytes).toString('base64');
            } else {
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                base64 = btoa(binary);
            }
        }

        try {
            const prompt = "Extrais fidèlement tout le texte visible de ce document. Réponds sous forme d'un objet JSON avec la clé 'text' contenant le texte intégral transcrit.";
            const schema = {
                type: "OBJECT",
                properties: {
                    text: { type: "STRING" }
                },
                required: ["text"]
            };

            const jsonResponse = await llmProvider.generateFromFile({
                prompt,
                mimeType: mimeType || 'application/pdf',
                data: base64,
                responseSchema: schema
            });

            let parsed;
            try {
                parsed = JSON.parse(jsonResponse);
            } catch (_) {
                parsed = { text: jsonResponse };
            }

            const text = (parsed.text || jsonResponse || '').trim();
            if (!text) {
                throw new Error("Le fichier est vide.");
            }

            const fingerprint = await this.computeFingerprint(base64);

            if (options && options.detailed) {
                return {
                    text,
                    pages: [{ pageNumber: 1, text }],
                    pageCount: 1,
                    fingerprint
                };
            }
            return text;
        } catch (err) {
            if (err.message && err.message.includes("Clé API manquante")) {
                throw new Error("Ce PDF est une image : ajoute une clé Gemini pour le lire, ou colle le texte.");
            }
            throw err;
        }
    }
}
