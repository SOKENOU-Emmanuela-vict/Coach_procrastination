/**
 * Utilitaire de redimensionnement d'image pour le profil utilisateur.
 * Limite la plus grande dimension à 256 px pour préserver l'espace de stockage IndexedDB.
 */
export function resizeImageToMax256(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            return reject(new Error("Le fichier sélectionné doit être une image."));
        }
        if (typeof FileReader === 'undefined') {
            return reject(new Error("FileReader non disponible."));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 256;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, w);
                canvas.height = Math.max(1, h);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Impossible de décoder l'image."));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Lecture du fichier image impossible."));
        reader.readAsDataURL(file);
    });
}
