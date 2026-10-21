/**
 * security.js
 * Utilitaires de sécurité inspirés des playbooks Anthropic Cybersecurity Skills :
 * - Protection contre le Cross-Site Scripting (XSS / DOM XSS)
 * - Validation stricte des protocoles d'URL (bloquant javascript:, vbscript:, data: malveillant)
 * - Assainissement d'objets contre la Prototype Pollution
 */

import { escapeHtml } from './html.js';

/**
 * Valide et assainit une URL pour utilisation sûre dans <a href="..."> ou window.open().
 * Rejette catégoriquement les protocoles d'exécution de code client (javascript:, vbscript:, data: html).
 * @param {string} url - URL brute fournie par l'utilisateur ou une source externe.
 * @param {string} fallback - Valeur de repli si l'URL est dangereuse (défaut: '#').
 * @returns {string} URL sûre ou fallback.
 */
export function sanitizeUrl(url, fallback = '#') {
    if (!url || typeof url !== 'string') return fallback;

    const trimmed = url.trim();
    if (!trimmed) return fallback;

    // Supprimer les caractères de contrôle invisibles qui peuvent contourner les filtres (ex: java\0script:)
    const sanitized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');

    // Vérifier les schémas dangereux (insensible à la casse)
    const lower = sanitized.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html')) {
        return fallback;
    }

    // Autoriser explicitement http://, https://, mailto:, et les chemins relatifs sûrs (/, ./)
    if (/^(https?:\/\/|mailto:|\/|\.\/)/i.test(sanitized)) {
        return sanitized;
    }

    // Si aucun schéma n'est spécifié mais qu'il ressemble à un domaine (ex: www.site.com ou formation.force-n.sn)
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(sanitized)) {
        return 'https://' + sanitized;
    }

    return fallback;
}

/**
 * Valide une source d'image (URL http(s), chemin relatif, ou data:image valide).
 * @param {string} src - Source brute de l'image.
 * @returns {string} Source sûre ou placeholder vide.
 */
export function sanitizeImageSrc(src) {
    if (!src || typeof src !== 'string') return '';
    const trimmed = src.trim();

    // Data URLs d'images autorisées
    if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
        return trimmed;
    }

    // URLs HTTP(S) et chemins relatifs
    return sanitizeUrl(trimmed, '');
}

/**
 * Protection contre la Prototype Pollution :
 * Nettoie récursivement un objet ou un tableau en supprimant les clés dangereuses
 * (__proto__, constructor, prototype).
 * @param {any} target - Donnée à assainir.
 * @returns {any} Donnée assainie exempte de pollution de prototype.
 */
export function deepSanitizeObject(target) {
    if (target === null || typeof target !== 'object') {
        return target;
    }

    if (Array.isArray(target)) {
        return target.map(item => deepSanitizeObject(item));
    }

    const cleanObj = Object.create(null);
    for (const [key, value] of Object.entries(target)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue; // Ignore et élimine la clé d'attaque
        }
        cleanObj[key] = deepSanitizeObject(value);
    }
    return cleanObj;
}

export { escapeHtml };
