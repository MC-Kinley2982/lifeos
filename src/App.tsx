import { AppShell } from './app/AppShell';
import { useRoute, type Route } from './app/router';
import { EventsPage } from './features/events/EventsPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { MorePage } from './features/more/MorePage';
import { Welcome } from './features/onboarding/Welcome';
import { RoutinesPage } from './features/routines/RoutinesPage';
import { AfterSchoolPrompt } from './features/school/AfterSchoolPrompt';
import { SchoolPage } from './features/school/SchoolPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TasksPage } from './features/tasks/TasksPage';
import { TodayPage } from './features/today/TodayPage';
import { WeekPage } from './features/week/WeekPage';
import { LinkDecisionDialog } from './features/cloud/LinkDecisionDialog';
import { useCloud } from './store/cloud';
import { usePlanMaintenance } from './store/schoolAutomation';
import { useAppStore } from './store/useAppStore';
import { Toaster } from './ui/toast';

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'day':
      return <TodayPage key={route.params[0]} dateParam={route.params[0]} />;
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

  return (
    <>
      {onboardingDone ? (
        <AppShell route={route.name}>
          <Page route={route} />
        </AppShell>
      ) : (
        <Welcome />
      )}
      <AfterSchoolPrompt enabled={onboardingDone && cloudReady && !linkPending} />
      <LinkDecisionDialog />
      <Toaster />
    </>
  );
}
