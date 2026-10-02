import { AppShell } from './app/AppShell';
import { useRoute, type Route } from './app/router';
import { EventsPage } from './features/events/EventsPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { MorePage } from './features/more/MorePage';
import { Welcome } from './features/onboarding/Welcome';
import { RoutinesPage } from './features/routines/RoutinesPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TasksPage } from './features/tasks/TasksPage';
import { TodayPage } from './features/today/TodayPage';
import { WeekPage } from './features/week/WeekPage';
import { useAppStore } from './store/useAppStore';
import { Toaster } from './ui/toast';

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'day':
      return <TodayPage key={route.params[0]} dateParam={route.params[0]} />;
    case 'week':
      return <WeekPage dateParam={route.params[0]} />;
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
  const route = useRoute();

  return (
    <>
      {onboardingDone ? (
        <AppShell route={route.name}>
          <Page route={route} />
        </AppShell>
      ) : (
        <Welcome />
      )}
      <Toaster />
    </>
  );
}
