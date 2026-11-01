/**
 * Motion Module — Learning OS
 * Centralise et contrôle sobrement les micro-animations GSAP de l'interface.
 * 
 * Règles :
 * - Toujours gardé par `if (typeof window !== 'undefined' && window.gsap)` : l'application fonctionne parfaitement sans.
 * - Respecte strictement `prefers-reduced-motion` : aucune animation si l'utilisateur l'a activé.
 * - Apparition échelonnée sobre (150 à 350 ms).
 * - Aucun effet infini sur les écrans de travail.
 */

export class Motion {
    /**
     * Vérifie si les animations peuvent être exécutées
     */
    static isAvailable() {
        if (typeof window === 'undefined' || !window.gsap) return false;
        if (typeof window.matchMedia === 'function') {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReduced) return false;
        }
        return true;
    }

    /**
     * Animation d'entrée échelonnée de cartes, éléments de liste ou lignes de tableau
     * @param {string|Element|Element[]} targets Sélecteur ou éléments
     * @param {Object} options Options optionnelles
     */
    static staggerIn(targets, options = {}) {
        if (!this.isAvailable()) return;
        const duration = options.duration ?? 0.25;
        const stagger = options.stagger ?? 0.04;
        const y = options.y ?? 10;

        window.gsap.fromTo(targets, 
            { opacity: 0, y: y },
            { 
                opacity: 1, 
                y: 0, 
                duration, 
                stagger, 
                ease: 'power1.out',
                clearProps: 'transform,opacity'
            }
        );
    }

    /**
     * Animation d'entrée douce pour un conteneur principal
     * @param {string|Element} target
     */
    static fadeIn(target, options = {}) {
        if (!this.isAvailable()) return;
        const duration = options.duration ?? 0.25;
        const y = options.y ?? 8;

        window.gsap.fromTo(target,
            { opacity: 0, y: y },
            {
                opacity: 1,
                y: 0,
                duration,
                ease: 'power1.out',
                clearProps: 'transform,opacity'
            }
        );
    }

    /**
     * Animation d'ouverture d'une modale
     * @param {Element} modalContainer
     */
    static modalOpen(modalContainer) {
        if (!this.isAvailable()) return;
        const box = modalContainer.querySelector('.modal-box, [class*="modal"]') || modalContainer;
        window.gsap.fromTo(box,
            { opacity: 0, scale: 0.96, y: 12 },
            { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' }
        );
    }

    /**
     * Retour visuel léger au clic sur un bouton
     * @param {Element} button
     */
    static buttonTap(button) {
        if (!this.isAvailable()) return;
        window.gsap.fromTo(button,
            { scale: 0.97 },
            { scale: 1, duration: 0.15, ease: 'power1.out', clearProps: 'transform' }
        );
    }

    /**
     * Animation d'apparition d'un nouveau message de chat
     * @param {Element} messageElement
     */
    static messageIn(messageElement) {
        if (!this.isAvailable()) return;
        window.gsap.fromTo(messageElement,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.2, ease: 'power1.out', clearProps: 'transform,opacity' }
        );
    }
}
