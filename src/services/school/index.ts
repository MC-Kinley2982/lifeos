/**
 * Schul-Logik (React-unabhängig): Stundenplan, Hausaufgaben, Tests und deren Planung.
 * Die UI ruft nur diese Funktionen bzw. die PlannerStrategy auf.
 */
export * from './types';
export * from './timetable';
export * from './homework';
export * from './exams';
export { planSchoolWork } from './schoolPlanner';
export { shouldAskForHomework } from './prompt';
