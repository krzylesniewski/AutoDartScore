import { CreateMatchRequest } from '@autoscore/schema';
import type { BestOf, MatchType, Player, PracticeMode, StartingScore } from '@autoscore/schema';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiRequestError, createMatch, createPlayer, listPlayers } from '../api/client';
import { WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const TYPES: readonly { value: MatchType; label: string }[] = [
  { value: 'match', label: pl.typeMatch },
  { value: 'casual', label: pl.typeCasual },
  { value: 'practice', label: pl.typePractice },
];

const PRACTICE_MODES: readonly { value: PracticeMode; label: string }[] = [
  { value: 'free_run', label: pl.freeRun },
  { value: 'solo_501', label: pl.solo501 },
];

const STARTING_SCORES: readonly StartingScore[] = [301, 501, 701];
const BEST_OF: readonly BestOf[] = [1, 3, 5];

const PLAYER_COUNT: Record<MatchType, { min: number; max: number }> = {
  match: { min: 2, max: 2 },
  casual: { min: 2, max: 4 },
  practice: { min: 1, max: 1 },
};

const choice = 'min-h-12 rounded-(--radius-card) border-(length:--border-width) px-4 font-display text-xl';

function choiceStyle(selected: boolean): string {
  return `${choice} ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`;
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiRequestError ? caught.message : pl.requestFailed;
}

export function NewGameScreen() {
  const [type, setType] = useState<MatchType>('match');
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [bestOf, setBestOf] = useState<BestOf>(3);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('free_run');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPlayers().then(
      (loaded) => {
        if (!cancelled) {
          // Utworzeni tu goście nie wracają z GET /players, więc zostają w stanie lokalnym.
          setPlayers((current) => [...loaded, ...current.filter((player) => !loaded.some((other) => other.id === player.id))]);
        }
      },
      () => {
        if (!cancelled) {
          setError(pl.loadPlayersFailed);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const count = PLAYER_COUNT[type];
  const countValid = selected.length >= count.min && selected.length <= count.max;

  function toggle(playerId: string): void {
    setSelected((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]));
  }

  function onCreated(player: Player): void {
    setPlayers((current) => [...current, player]);
    setSelected((current) => [...current, player.id]);
  }

  function buildRequest(): unknown {
    if (type === 'match') {
      return { type, playerIds: selected, startingScore, bestOf };
    }
    if (type === 'casual') {
      return { type, playerIds: selected, startingScore };
    }
    return { type, playerIds: selected, practiceMode };
  }

  async function start(event: FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = CreateMatchRequest.safeParse(buildRequest());
    if (!parsed.success) {
      setError(pl.playerCountHint[type]);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const match = await createMatch(parsed.data);
      window.location.hash = `#/matches/${encodeURIComponent(match.id)}`;
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl font-bold uppercase">{pl.newGame}</h1>
        <a href="#/stats" className="font-display text-xl font-semibold uppercase text-(--color-text) underline">
          {pl.stats}
        </a>
      </div>
      <form onSubmit={(event) => void start(event)} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)">{pl.gameType}</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((option) => (
              <button key={option.value} type="button" aria-pressed={type === option.value} onClick={() => setType(option.value)} className={choiceStyle(type === option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)">{pl.players}</legend>
          {players.length === 0 && <p className="text-(--color-text-muted)">{pl.noPlayers}</p>}
          <div className="flex flex-wrap gap-2">
            {players.map((player) => {
              const order = selected.indexOf(player.id);
              return (
                <button key={player.id} type="button" aria-pressed={order >= 0} onClick={() => toggle(player.id)} className={`${choiceStyle(order >= 0)} flex items-center gap-2`}>
                  {order >= 0 && <span className="rounded-(--radius-chip) bg-(--color-bg) px-2 text-sm text-(--color-text)">{order + 1}</span>}
                  {player.avatar && <span aria-hidden="true">{player.avatar}</span>}
                  {player.name}
                </button>
              );
            })}
          </div>
          <NewPlayerForm onCreated={onCreated} onError={(caught) => setError(errorMessage(caught))} />
          <p className="text-(--color-text-muted)">{pl.playerCountHint[type]}</p>
        </fieldset>

        {type !== 'practice' && (
          <Options<StartingScore> legend={pl.startingScore} options={STARTING_SCORES.map((value) => ({ value, label: String(value) }))} value={startingScore} onChange={setStartingScore} />
        )}
        {type === 'match' && (
          <Options<BestOf> legend={pl.bestOf} options={BEST_OF.map((value) => ({ value, label: pl.bestOfOption(value) }))} value={bestOf} onChange={setBestOf} />
        )}
        {type === 'practice' && <Options<PracticeMode> legend={pl.practiceMode} options={PRACTICE_MODES} value={practiceMode} onChange={setPracticeMode} />}

        {error && (
          <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
            <WarningIcon />
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!countValid || submitting}
          className="min-h-14 rounded-(--radius-card) bg-(--color-accent) px-6 font-display text-2xl font-bold uppercase text-(--color-on-accent) disabled:opacity-40"
        >
          {pl.startGame}
        </button>
      </form>
    </main>
  );
}

interface OptionsProps<T extends string | number> {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}

function Options<T extends string | number>({ legend, options, value, onChange }: OptionsProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={choiceStyle(value === option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface NewPlayerFormProps {
  onCreated(player: Player): void;
  onError(caught: unknown): void;
}

function NewPlayerForm({ onCreated, onError }: NewPlayerFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [guest, setGuest] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${choice} self-start border-dashed border-(--color-border-strong) text-(--color-text-muted)`}>
        {pl.newPlayer}
      </button>
    );
  }

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const trimmedAvatar = avatar.trim();
      const player = await createPlayer({ name: name.trim(), guest, ...(trimmedAvatar ? { avatar: trimmedAvatar } : {}) });
      onCreated(player);
      setOpen(false);
      setName('');
      setAvatar('');
      setGuest(false);
    } catch (caught) {
      onError(caught);
    } finally {
      setSaving(false);
    }
  }

  // Osobny blok zamiast zagnieżdżonego formularza, bo HTML nie pozwala na form w form.
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) p-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-(--color-text-muted)">{pl.playerName}</span>
        <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className="min-h-12 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-bg) px-3 text-xl" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-(--color-text-muted)">{pl.playerAvatar}</span>
        <input value={avatar} maxLength={16} onChange={(event) => setAvatar(event.target.value)} className="min-h-12 w-28 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-bg) px-3 text-xl" />
      </label>
      <label className="flex min-h-12 items-center gap-2">
        <input type="checkbox" checked={guest} onChange={(event) => setGuest(event.target.checked)} className="h-6 w-6" />
        <span className="text-xl">{pl.guest}</span>
      </label>
      <button type="button" disabled={saving || name.trim() === ''} onClick={() => void save()} className={`${choice} border-(--color-text) bg-(--color-text) text-(--color-text-inverse) disabled:opacity-40`}>
        {pl.addPlayer}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={`${choice} border-(--color-border-strong) text-(--color-text-muted)`}>
        {pl.cancel}
      </button>
    </div>
  );
}
