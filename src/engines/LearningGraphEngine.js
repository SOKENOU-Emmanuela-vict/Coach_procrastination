import { AppLogger } from '../utils/AppLogger.js';
import { LearningNode } from '../models/LearningNode.js';

export class LearningGraphEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }
    
    async evaluateGraph() {
        const history = await this.storage.loadData('study_history') || [];
        const subjects = await this.storage.loadData('acad_subjects') || [];
        const projects = await this.storage.loadData('projects') || [];
        
        let nodes = {};
        
        // 1. Matières Académiques
        subjects.forEach(s => {
            nodes[s.id] = new LearningNode(s.id, `🎓 ${s.name || s.id}`);
            nodes[s.id].color = "#00f2fe"; 
        });

        // 2. Projets (Life / Skills)
        projects.forEach(p => {
            let icon = '📌';
            let color = '#88a7b7';
            if (p.category === 'skill') {
                icon = '💻';
                color = '#ff9800';
            } else if (p.category === 'hobby' || p.category === 'wellbeing') {
                icon = '🌱';
                color = '#4caf50';
            }
            nodes[p.id] = new LearningNode(p.id, `${icon} ${p.title || p.id}`);
            nodes[p.id].color = color;
        });

        // 3. Langues (Domaine séparé)
        nodes['languages'] = new LearningNode('languages', '🌍 Langues (Anglais/Français)');
        nodes['languages'].color = '#e91e63';
        
        // Ancienne map de compatibilité pour l'historique
        const categoryMap = {
            'eloquence_fr': 'languages',
            'english_speaking': 'languages',
            'reading': 'languages',
            'cyber_network': 'cyber',
            'cyber_linux': 'cyber',
            'cyber_tryhackme': 'cyber',
            'cyber_osint': 'cyber',
            'ia_python': 'ia',
            'ia_numpy': 'ia',
            'ia_pandas': 'ia',
            'ia_ml': 'ia',
            'dev_git': 'ia',
            'data_excel': 'excel'
        };
        
        for(let key in nodes) {
            nodes[key].level = 0;
            nodes[key].confidence = 0;
            nodes[key].proofs = [];
            nodes[key].hours = 0;
        }

        history.forEach(r => {
            if (r.status === 'completed' || r.status === 'partial') {
                // Mapping : on cherche d'abord projectId, puis subjectId, puis l'ancien skillId
                const rawSkillId = r.projectId || r.subjectId || r.skillId || 'reflection';
                
                // On essaie de trouver le noeud direct, sinon on tente la fallback map
                let catId = rawSkillId;
                if (!nodes[catId] && categoryMap[catId]) {
                    catId = categoryMap[catId];
                }
                
                if (nodes[catId]) {
                    const node = nodes[catId];
                    node.lastPractice = r.date;
                    // Actual duration est en minutes. 1h = 60 minutes.
                    // level = progression relative (XP)
                    node.level = Math.min(100, node.level + Math.floor(r.actualDuration / 15));
                    node.confidence = Math.min(100, node.confidence + (r.quality * 2));
                    node.hours += (r.actualDuration / 60);
                    
                    if (r.proof && r.proof.url || r.proof && r.proof.image || r.proof && r.proof.type) {
                        node.proofs.push(r.proof);
                    }
                }
            }
        });
        
        AppLogger.info("LearningGraphEngine: Graphe d'apprentissage évalué (avec catégories).");

        return Object.values(nodes);
    }
}
