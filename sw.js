const CACHE_NAME = 'learning-os-v2.3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './assets/profile.jpg',
  './data/events.json',
  './data/manifest.json',
  './data/resources.json',
  './data/skills.json',
  './src/ai/ChatIntentParser.js',
  './src/ai/CoachAI.js',
  './src/ai/CoachContext.js',
  './src/ai/CoachLLMReasoning.js',
  './src/ai/CoachLocalReply.js',
  './src/ai/CoachOrchestrator.js',
  './src/ai/CoachReasoning.js',
  './src/ai/ExamRevisionPlanner.js',
  './src/ai/FlexibleConflictDialog.js',
  './src/ai/GeminiProvider.js',
  './src/ai/LLMProvider.js',
  './src/ai/MockLLMProvider.js',
  './src/ai/PlanningAI.js',
  './src/ai/PromptBuilder.js',
  './src/config/config.js',
  './src/config/constants.js',
  './src/contracts/AnalyticsContract.js',
  './src/contracts/CoachContract.js',
  './src/contracts/StorageContract.js',
  './src/core/App.js',
  './src/core/Bootstrap.js',
  './src/core/Router.js',
  './src/data/AcademicCurriculum.js',
  './src/data/AcademicSeeder.js',
  './src/engines/AcademicEngine.js',
  './src/engines/AppPresenceEngine.js',
  './src/engines/ChatHistoryEngine.js',
  './src/engines/CheckInEngine.js',
  './src/engines/CourseProgressEngine.js',
  './src/engines/DailySnapshotEngine.js',
  './src/engines/DocumentChunker.js',
  './src/engines/DocumentExtractor.js',
  './src/engines/KnowledgeEngine.js',
  './src/engines/KnowledgeRetriever.js',
  './src/engines/LanguageEngine.js',
  './src/engines/LearningGraphEngine.js',
  './src/engines/PlanningEngine.js',
  './src/engines/PlanningIntelligence.js',
  './src/engines/ProjectEngine.js',
  './src/engines/ReflectionEngine.js',
  './src/engines/RiskEngine.js',
  './src/engines/ScheduleIngestionEngine.js',
  './src/engines/SchedulerEngine.js',
  './src/engines/StudyRecordEngine.js',
  './src/engines/SubjectMatcher.js',
  './src/engines/TextNormalizer.js',
  './src/engines/TimetableImportEngine.js',
  './src/engines/WeeklyReviewEngine.js',
  './src/models/AcademicYear.js',
  './src/models/Assessment.js',
  './src/models/AvailabilityWindow.js',
  './src/models/Book.js',
  './src/models/DailyCheckIn.js',
  './src/models/Document.js',
  './src/models/DocumentChunk.js',
  './src/models/Event.js',
  './src/models/Goal.js',
  './src/models/Grade.js',
  './src/models/Habit.js',
  './src/models/LearningNode.js',
  './src/models/LLMDecision.js',
  './src/models/Message.js',
  './src/models/PersonalTask.js',
  './src/models/PlanningIntent.js',
  './src/models/Project.js',
  './src/models/ScheduleImportEntry.js',
  './src/models/Semester.js',
  './src/models/StudyRecord.js',
  './src/models/Subject.js',
  './src/models/User.js',
  './src/models/WeeklyReview.js',
  './src/services/IndexedDBProvider.js',
  './src/services/MemoryProvider.js',
  './src/services/StorageProvider.js',
  './src/ui/AcademicView.js',
  './src/ui/BilanView.js',
  './src/ui/CalendarView.js',
  './src/ui/CoachChatView.js',
  './src/ui/DashboardView.js',
  './src/ui/DesktopView.js',
  './src/ui/EventModal.js',
  './src/ui/FocusView.js',
  './src/ui/LanguageView.js',
  './src/ui/LifeView.js',
  './src/ui/PlanningView.js',
  './src/ui/PortfolioView.js',
  './src/ui/styles/main.css',
  './src/ui/styles/univers-bureau.css',
  './src/ui/styles/univers-ecole.css',
  './src/ui/styles/univers-langues.css',
  './src/ui/styles/univers-vie.css',
  './src/ui/WeeklyView.js',
  './src/utils/AppLogger.js',
  './src/utils/dateUtils.js',
  './src/utils/html.js',
  './src/utils/security.js',
  './vendor/bootstrap-icons/bootstrap-icons.min.css',
  './vendor/bootstrap-icons/fonts/bootstrap-icons.woff2',
  './vendor/gsap/gsap.min.js'
];

function isCacheFirstAsset(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.includes('/vendor/')) return true;
  if (
    lower.endsWith('.woff2') ||
    lower.endsWith('.woff') ||
    lower.endsWith('.ttf') ||
    lower.endsWith('.otf')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
            return false;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (!request || request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  // Uniquement les requêtes GET de même origine (jamais Gemini ni ressources externes)
  if (url.origin !== self.location.origin) return;

  // Ne jamais intercepter le script du service worker lui-même
  if (url.pathname.endsWith('/sw.js')) return;

  const cleanUrl = url.origin + url.pathname;

  // 1. Stratégie « cache d'abord + mise en cache dynamique » pour vendor/ et polices
  if (isCacheFirstAsset(url.pathname)) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = (await cache.match(cleanUrl)) || (await cache.match(request));
        if (cached) return cached;

        const response = await fetch(request);
        if (response && response.ok && response.status === 200) {
          await cache.put(cleanUrl, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 2. Stratégie « réseau d'abord avec repli sur le cache » pour index.html, .js, .css, .json et assets applicatifs
  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response && response.ok && response.status === 200) {
          await cache.put(cleanUrl, response.clone());
        }
        return response;
      } catch (err) {
        const cached =
          (await cache.match(cleanUrl)) ||
          (await cache.match(request)) ||
          (await cache.match(request, { ignoreSearch: true }));
        if (cached) return cached;

        if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
          const fallbackHtml =
            (await cache.match(new URL('./index.html', self.location.origin).href)) ||
            (await cache.match('./index.html'));
          if (fallbackHtml) return fallbackHtml;
        }
        throw err;
      }
    })
  );
});
