import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { AppShell } from './app/AppShell';
import { useRoute, type Route } from './app/router';
import { AfterSchoolPrompt } from './features/school/AfterSchoolPrompt';
import { HomeworkTimePrompt } from './features/school/HomeworkTimePrompt';
import { TodayPage } from './features/today/TodayPage';
import { TodosPage } from './features/todos/TodosPage';
import { LinkDecisionDialog } from './features/cloud/LinkDecisionDialog';
import { useCloud } from './store/cloud';
import { useGoogleCalendarSync } from './store/googleCalendar';
import { useIncomingLinks } from './store/incomingLinks';
import { usePlanMaintenance } from './store/schoolAutomation';
import { useAppStore } from './store/useAppStore';
import { Toaster } from './ui/toast';

/**
 * Code-Splitting: "Heute" und "To-dos" sind sofort da, alle anderen Bereiche werden als eigene
 * Dateien nachgeladen – das hält den Start auf dem iPhone schnell. Kurz nach dem Start lädt die
 * App sie im Hintergrund vor, damit der Wechsel trotzdem ohne Wartezeit klappt (offline über den Service Worker).
 */
const prefetchers: Array<() => Promise<unknown>> = [];

function lazyPage<M extends Record<K, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K): LazyExoticComponent<M[K]> {
  prefetchers.push(load);
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const WeekPage = lazyPage(() => import('./features/week/WeekPage'), 'WeekPage');
const SchoolPage = lazyPage(() => import('./features/school/SchoolPage'), 'SchoolPage');
const TasksPage = lazyPage(() => import('./features/tasks/TasksPage'), 'TasksPage');
const GoalsPage = lazyPage(() => import('./features/goals/GoalsPage'), 'GoalsPage');
const EventsPage = lazyPage(() => import('./features/events/EventsPage'), 'EventsPage');
const RoutinesPage = lazyPage(() => import('./features/routines/RoutinesPage'), 'RoutinesPage');
const ReviewPage = lazyPage(() => import('./features/review/ReviewPage'), 'ReviewPage');
const SettingsPage = lazyPage(() => import('./features/settings/SettingsPage'), 'SettingsPage');
const MorePage = lazyPage(() => import('./features/more/MorePage'), 'MorePage');
const Welcome = lazyPage(() => import('./features/onboarding/Welcome'), 'Welcome');

/** Seiten im Hintergrund vorladen, sobald der Browser Zeit hat. */
function usePrefetchPages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = () => prefetchers.forEach((load) => void load().catch(() => undefined));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(run, 1500);
    return () => globalThis.clearTimeout(id);
  }, [enabled]);
}

/** Platzhalter, solange ein Bereich nachgeladen wird (erscheint erst nach kurzer Verzögerung, kein Flackern). */
function PageFallback() {
  return (
    <div className="flex justify-center py-24 opacity-0 [animation:fade-in_0.2s_ease-out_0.25s_both]" role="status" aria-label="Wird geladen">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-violet-300" />
    </div>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'day':
      return <TodayPage key={route.params[0]} dateParam={route.params[0]} />;
    case 'todos':
      return <TodosPage />;
    case 'week':
      return <WeekPage dateParam={route.params[0]} />;
    case 'school':
      return <SchoolPage tab={route.params[0]} />;
    case 'tasks':
      return <TasksPage />;
    case 'goals':
      return <GoalsPage />;
    case 'events':
      return <EventsPage />;
    case 'routines':
      return <RoutinesPage />;
    case 'review':
      return <ReviewPage weekParam={route.params[0]} />;
    case 'settings':
      return <SettingsPage section={route.params[0]} />;
    case 'more':
      return <MorePage />;
    default:
      return <TodayPage />;
  }
}

export function App() {
  const onboardingDone = useAppStore((s) => s.settings.onboardingDone);
  // Automatisch planen erst, wenn die Cloud-Daten geladen sind (sonst würde mit veraltetem Stand geplant).
  const cloudReady = useCloud((s) => s.ready);
  const linkPending = useCloud((s) => !!s.linkDecision);
  const route = useRoute();
  usePlanMaintenance(onboardingDone && cloudReady && !linkPending);
  // Google Kalender nur synchronisieren, wenn verbunden und auf diesem Gerät angemeldet – nie ungefragt.
  useGoogleCalendarSync(onboardingDone && cloudReady && !linkPending);
  // Kurzbefehle/Siri: #/todos?add=… legt To-dos an (auch erst nach dem Onboarding bzw. Cloud-Abgleich).
  useIncomingLinks(onboardingDone && cloudReady && !linkPending);
  usePrefetchPages(onboardingDone);

  return (
    <>
      {onboardingDone ? (
        <AppShell route={route.name}>
          <Suspense fallback={<PageFallback />}>
            <Page route={route} />
          </Suspense>
        </AppShell>
      ) : (
        <Suspense fallback={<PageFallback />}>
          <Welcome />
        </Suspense>
      )}
      <AfterSchoolPrompt enabled={onboardingDone && cloudReady && !linkPending} />
      <HomeworkTimePrompt />
      <LinkDecisionDialog />
      <Toaster />
    </>
  );
}
