import { useState, type ReactNode } from 'react';
import { Bell, CalendarCheck, Repeat, Sparkles, X } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { formatDuration, relativeDayLabel, toDateKey, toHHMM, toMinutes } from '../../domain/time';
import type { Todo, TodoRepeat } from '../../domain/types';
import { defaultRepeat, firstOccurrenceFrom, nextOccurrence, occursOn, repeatLabel, type RepeatType } from '../../services/todos/repeat';
import { fieldsToWhen, whenToFields, type TodoWhen } from '../../services/todos/todos';
import { useNow } from '../../store/hooks';
import { planTodo, TODO_PLAN_MINUTES, unplanTodo, type TodoPlanOutcome } from '../../store/todoPlanning';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { DeleteButton, Segmented, Toggle, WeekdayPicker } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextArea, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';

const WHEN_OPTIONS: Array<{ value: TodoWhen; label: string }> = [
  { value: 'today', label: 'Heute' },
  { value: 'tomorrow', label: 'Morgen' },
  { value: 'week', label: 'Woche' },
  { value: 'later', label: 'Später' },
  { value: 'date', label: 'Datum' },
];

const REPEAT_OPTIONS: Array<{ value: RepeatType | 'none'; label: string }> = [
  { value: 'none', label: 'Nie' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
];

const REPEAT_UNIT: Record<RepeatType, string> = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate' };

const REMINDER_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Zur Uhrzeit' },
  { value: 10, label: '10 Minuten vorher' },
  { value: 30, label: '30 Minuten vorher' },
  { value: 60, label: '1 Stunde vorher' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors',
        active ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Details eines To-dos: Wann, Uhrzeit, Notiz, Erinnerung/Google Kalender (optional) und "Planen". */
export function TodoSheet({ todoId, onClose }: { todoId: string; onClose: () => void }) {
  const now = useNow();
  const today = toDateKey(now);
  const todo = useAppStore((s) => s.todos.find((t) => t.id === todoId));
  const task = useAppStore((s) => (todo?.taskId ? s.tasks.find((t) => t.id === todo.taskId) : undefined));
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const google = useAppStore((s) => s.settings.integrations.googleCalendar);
  const { updateTodo, removeTodo } = useAppStore.getState();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [minutes, setMinutes] = useState(task?.estimatedMin ?? 30);
  const [customReminder, setCustomReminder] = useState(false);
  const [outcome, setOutcome] = useState<TodoPlanOutcome | null>(null);

  if (!todo) return null;
  const patch = (p: Partial<Todo>) => updateTodo(todo.id, p);
  const when = fieldsToWhen(todo, today);
  const commitTitle = () => {
    const t = title.trim();
    if (t && t !== todo.title) patch({ title: t });
    else setTitle(todo.title);
  };
  const googleReady = !!google.calendarId && google.push.todos;
  const hasDay = todo.horizon === 'day' && !!todo.date;
  const defaultTime = toHHMM(Math.min(23 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 60) * 60));
  const reminderIsPreset = !todo.reminder || REMINDER_OPTIONS.some((o) => o.value === todo.reminder!.minutesBefore);

  const plan = (m: number) => {
    setMinutes(m);
    setOutcome(planTodo(todo.id, m));
  };

  /** Wiederholung setzen: Der Tag des To-dos rückt bei Bedarf auf das erste passende Vorkommen ab heute. */
  const applyRepeat = (rule: TodoRepeat | undefined) => {
    if (!rule) return patch({ repeat: undefined });
    const keep = hasDay && occursOn(rule, todo.date!) ? todo.date! : undefined;
    const date = keep ?? firstOccurrenceFrom(rule, today) ?? today;
    patch({ repeat: { ...rule, anchor: date } as TodoRepeat, horizon: 'day', date });
  };
  const repeatType: RepeatType | 'none' = todo.repeat?.type ?? 'none';
  const afterNext = todo.repeat && hasDay ? nextOccurrence(todo.repeat, todo.date! > today ? todo.date! : today) : undefined;

  return (
    <Sheet
      open
      onClose={() => {
        commitTitle();
        onClose();
      }}
      title="To-do"
      footer={
        <div className="flex items-center justify-between gap-2">
          <DeleteButton
            onConfirm={() => {
              removeTodo(todo.id);
              onClose();
            }}
          />
          <Button
            variant="primary"
            onClick={() => {
              commitTitle();
              onClose();
            }}
          >
            Fertig
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          aria-label="Titel"
          className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-base font-medium focus:border-violet-400/60 focus:outline-none"
        />

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Wann?</span>
          <div className="flex flex-wrap gap-1.5">
            {WHEN_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={when === o.value}
                onClick={() => {
                  const fields = whenToFields(o.value, today, weekStartsOn, o.value === 'date' ? (todo.date ?? today) : undefined);
                  // Eine Wiederholung braucht einen festen Tag.
                  patch({ ...fields, ...(fields.horizon !== 'day' ? { repeat: undefined } : {}) });
                }}
              >
                {o.label}
              </Chip>
            ))}
          </div>
          {when === 'date' && (
            <DateInput className="mt-2" value={todo.date ?? today} min={today} onChange={(v) => v && patch({ horizon: 'day', date: v })} />
          )}
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Repeat size={12} /> Wiederholen
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REPEAT_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={repeatType === o.value}
                onClick={() => applyRepeat(o.value === 'none' ? undefined : o.value === repeatType ? todo.repeat : defaultRepeat(o.value, hasDay ? todo.date! : today))}
              >
                {o.label}
              </Chip>
            ))}
          </div>
          {todo.repeat && (
            <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface/60 p-3">
              {todo.repeat.type === 'weekly' && (
                <WeekdayPicker
                  value={todo.repeat.weekdays}
                  weekStartsOn={weekStartsOn}
                  onChange={(weekdays) => weekdays.length > 0 && applyRepeat({ ...todo.repeat!, weekdays } as TodoRepeat)}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Alle">
                  <NumberInput
                    value={todo.repeat.every}
                    min={1}
                    max={52}
                    suffix={REPEAT_UNIT[todo.repeat.type]}
                    onChange={(v) => applyRepeat({ ...todo.repeat!, every: Math.min(52, Math.max(1, Math.round(v) || 1)) })}
                  />
                </Field>
                {todo.repeat.type === 'monthly' && (
                  <Field label="Am Tag">
                    <NumberInput
                      value={todo.repeat.day}
                      min={1}
                      max={31}
                      suffix="."
                      onChange={(v) => applyRepeat({ ...todo.repeat!, day: Math.min(31, Math.max(1, Math.round(v) || 1)) } as TodoRepeat)}
                    />
                  </Field>
                )}
              </div>
              <div className="space-y-1 text-xs leading-relaxed">
                <p className="text-ink-muted">
                  <span className="font-medium text-ink">{repeatLabel(todo.repeat)}</span>
                  {hasDay && ` · fällig ${relativeDayLabel(todo.date!, today)}`}
                  {afterNext && ` · danach ${relativeDayLabel(afterNext, today)}`}
                </p>
                <p className="text-ink-faint">
                  Nach dem Abhaken erscheint automatisch das nächste Vorkommen. Verpasstes stapelt sich nicht – das To-do rückt auf das letzte fällige Vorkommen.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Uhrzeit (optional)">
            {todo.time ? (
              <div className="flex gap-1.5">
                <TimeInput value={todo.time} onChange={(v) => patch({ time: v })} />
                <button
                  type="button"
                  aria-label="Uhrzeit entfernen"
                  onClick={() => patch({ time: undefined, reminder: undefined })}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-faint hover:bg-white/5 hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <Button block onClick={() => patch({ time: defaultTime })}>
                Uhrzeit festlegen
              </Button>
            )}
          </Field>
          <Field label="Wichtig?">
            <Segmented<'normal' | 'high'>
              value={todo.priority === 'high' || todo.priority === 'urgent' ? 'high' : 'normal'}
              onChange={(v) => patch({ priority: v === 'high' ? 'high' : undefined })}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'Wichtig' },
              ]}
            />
          </Field>
        </div>

        <Field label="Notiz (optional)">
          <TextArea value={todo.note ?? ''} onChange={(e) => patch({ note: e.target.value || undefined })} className="text-base" />
        </Field>

        {/* ── Planen ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-line bg-surface/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} className="text-violet-300" /> Planen
          </h3>
          {!task ? (
            <>
              <p className="mt-1 text-xs text-ink-muted">
                Gerade ist das nur ein To-do – es blockiert keine Zeit. Mit „Planen“ sucht LifeOS einen passenden freien Zeitraum (Freizeit-Schutz und
                geschützte Zeiten bleiben unangetastet).
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {TODO_PLAN_MINUTES.map((m) => (
                  <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                    {formatDuration(m)}
                  </Chip>
                ))}
              </div>
              <Button variant="primary" icon={Sparkles} className="mt-3" onClick={() => plan(minutes)}>
                {formatDuration(minutes)} einplanen
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm">
                {task.schedule?.start ? (
                  <>
                    Geplant: <span className="font-medium">{relativeDayLabel(task.schedule.date, today)} {task.schedule.start}–{toHHMM(toMinutes(task.schedule.start) + task.estimatedMin)}</span>{' '}
                    <span className="text-ink-muted">({formatDuration(task.estimatedMin)})</span>
                  </>
                ) : (
                  <span className="text-ink-muted">Noch kein freier Platz gefunden – LifeOS berücksichtigt es bei der nächsten Planung („Woche planen“).</span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={Sparkles} onClick={() => plan(task.estimatedMin)}>
                  Neu planen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    unplanTodo(todo.id);
                    setOutcome(null);
                  }}
                >
                  Nicht mehr planen
                </Button>
              </div>
            </>
          )}
          {outcome && (
            <p className={cn('mt-3 rounded-xl px-3 py-2 text-xs', outcome.placed ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200')}>
              {outcome.placed
                ? `Eingeplant: ${relativeDayLabel(outcome.placed.date, today)} ${outcome.placed.start}–${outcome.placed.end}.`
                : `${outcome.reason} Das To-do bleibt geplant und wird bei der nächsten Planung berücksichtigt.`}
            </p>
          )}
        </section>

        {/* ── Erinnerung & Google Kalender (nur auf Wunsch) ─── */}
        <section className="rounded-2xl border border-line bg-surface/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck size={15} className="text-sky-300" /> Google Kalender & Erinnerung
          </h3>
          {!googleReady ? (
            <p className="mt-1 text-xs text-ink-muted">
              Erinnerungen kommen über Google Kalender aufs Handy.{' '}
              {google.calendarId ? 'Erlaube dafür „To-dos mit Kalendertermin“' : 'Verbinde dafür Google Kalender'} unter{' '}
              <a href={hrefFor(PATHS.settings('konto'))} className="text-violet-300 hover:underline">
                Mein Alltag → Konto & Integrationen
              </a>
              . Ohne das bleibt das To-do einfach auf deiner Liste.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              <Toggle
                checked={!!todo.googleCalendarSync}
                disabled={!hasDay}
                onChange={(v) => patch({ googleCalendarSync: v || undefined, ...(v ? {} : { reminder: undefined }) })}
                label="In Google Kalender eintragen"
                description={hasDay ? (todo.time || task?.schedule?.start ? 'Als Termin zur Uhrzeit' : 'Ohne Uhrzeit als ganztägiger Eintrag') : 'Dafür braucht das To-do einen festen Tag.'}
              />
              {todo.googleCalendarSync && hasDay && (
                <Field label={<span className="inline-flex items-center gap-1.5"><Bell size={12} /> Erinnerung</span>} hint={!todo.time && !task?.schedule?.start ? 'Für eine Erinnerung zuerst eine Uhrzeit festlegen.' : undefined}>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip active={!todo.reminder && !customReminder} onClick={() => { setCustomReminder(false); patch({ reminder: undefined }); }}>
                      Keine
                    </Chip>
                    {(todo.time || task?.schedule?.start) &&
                      REMINDER_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          active={!customReminder && todo.reminder?.minutesBefore === o.value}
                          onClick={() => {
                            setCustomReminder(false);
                            patch({ reminder: { minutesBefore: o.value } });
                          }}
                        >
                          {o.label}
                        </Chip>
                      ))}
                    {(todo.time || task?.schedule?.start) && (
                      <Chip active={customReminder || !reminderIsPreset} onClick={() => setCustomReminder(true)}>
                        Benutzerdefiniert
                      </Chip>
                    )}
                  </div>
                  {(customReminder || !reminderIsPreset) && (
                    <NumberInput
                      className="mt-2"
                      value={todo.reminder?.minutesBefore ?? 15}
                      min={0}
                      step={5}
                      suffix="min vorher"
                      onChange={(v) => patch({ reminder: { minutesBefore: Math.max(0, v) } })}
                    />
                  )}
                </Field>
              )}
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}
