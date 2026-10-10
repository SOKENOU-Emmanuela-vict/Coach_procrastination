export class Book {
    constructor(config = {}) {
        this.id = config.id || `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.title = config.title || '';
        this.domain = config.domain || 'lecture'; // ecole, langue, fitness, lecture, projet, perso
        this.author = config.author || '';
        this.totalPages = config.totalPages || 0;
        this.pagesRead = config.pagesRead || 0;
        this.totalChapters = config.totalChapters || 0;
        this.chaptersRead = config.chaptersRead || 0;
        this.status = config.status || 'to_read'; // to_read, reading, finished
        this.targetDate = config.targetDate || null;
        
        if (!config.status) this.updateProgress({});
    }

    get progress() {
        if (this.totalPages > 0) {
            return Math.round((this.pagesRead / this.totalPages) * 100);
        } else if (this.totalChapters > 0) {
            return Math.round((this.chaptersRead / this.totalChapters) * 100);
        }
        return this.status === 'finished' ? 100 : 0;
    }

    updateProgress({ pagesRead, chaptersRead }) {
        if (pagesRead !== undefined) this.pagesRead = pagesRead;
        if (chaptersRead !== undefined) this.chaptersRead = chaptersRead;
        
        if ((this.totalPages > 0 && this.pagesRead >= this.totalPages) ||
            (this.totalChapters > 0 && this.chaptersRead >= this.totalChapters)) {
            this.status = 'finished';
        } else if (this.pagesRead > 0 || this.chaptersRead > 0) {
            this.status = 'reading';
        }
    }
}
