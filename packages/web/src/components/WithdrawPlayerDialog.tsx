import type { TournamentView } from '@autoscore/schema';
import { useId, useRef, useState, type FormEvent } from 'react';
import { withdrawPlayer } from '../api/client';
import { apiErrorText } from '../api/error-text';
import { fixtureLabel, lowerFirst } from '../game/fixture-label';
import { openFixturesOf, withdrawCandidates } from '../game/tournament-incidents';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { Dialog } from './Dialog';
import { WarningIcon } from './icons';

export interface WithdrawPlayerDialogProps {
  view: TournamentView;
  onSaved(view: TournamentView): void;
  onFailed(): void;
  onCancel(): void;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
// Globalny pierścień fokusu pomija radio, więc fokus rysuje karta, która je obejmuje.
const playerCard =
  'relative flex h-18 min-w-0 cursor-pointer items-center gap-3 rounded-(--radius-card) px-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--color-focus)';
const checkedCard = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) inset-ring-2 inset-ring-(--color-text)';
const uncheckedCard = 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)';

export function WithdrawPlayerDialog({ view, onSaved, onFailed, onCancel }: WithdrawPlayerDialogProps) {
  const titleId = useId();
  const textId = useId();
  const groupName = useId();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const candidates = withdrawCandidates(view);
  const chosen = candidates.find((player) => player.id === playerId);
  // Gracz wycofany w międzyczasie na innym urządzeniu znika z wyboru.
  if (playerId !== null && !chosen) {
    setPlayerId(null);
  }
  const open = chosen ? openFixturesOf(view, chosen.id) : [];
  const running = open.find((fixture) => fixture.status === 'in_progress');

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!chosen || pending.current) {
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      onSaved(await withdrawPlayer(view.id, chosen.id, view.eventSeq));
    } catch (caught) {
      setError(apiErrorText(caught));
      pending.current = false;
      setSaving(false);
      onFailed();
    }
  }

  return (
    // Fokus na oknie, bo nic nie jest wybrane, a wybór gracza ma być świadomy.
    <Dialog labelledBy={titleId} {...(chosen ? { describedBy: textId } : {})} className="gap-5" busy={saving} onClose={onCancel}>
      <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
        {pl.withdrawTitle}
      </h2>
      <form onSubmit={(event) => void save(event)} className="relative flex flex-col gap-5">
        <fieldset className="flex min-w-0 flex-col">
          <legend className={`mb-2.5 ${label}`}>{pl.withdrawLegend}</legend>
          {/* Zaznaczenie ma pierścień, kropkę i grubsze imię, więc kolor nie jest jedyną wskazówką. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {candidates.map((player) => {
              const checked = playerId === player.id;
              return (
                <label key={player.id} className={`${playerCard} ${checked ? checkedCard : uncheckedCard}`}>
                  <input
                    type="radio"
                    name={groupName}
                    value={player.id}
                    checked={checked}
                    onChange={() => setPlayerId(player.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-(--color-text)' : 'border-(--color-text-muted)'}`}
                  >
                    {checked && <span className="size-3 rounded-full bg-(--color-text)" />}
                  </span>
                  <Avatar name={player.name} avatar={player.avatar} color={player.color} size="medium" />
                  <span className={`min-w-0 truncate font-display text-2xl ${checked ? 'font-bold' : 'font-semibold'}`}>{player.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {chosen && (
          <div id={textId} className="flex flex-col gap-1.5 text-[17px] leading-snug text-(--color-text-sub)">
            <p className="font-semibold text-(--color-text)">
              {open.length === 0 ? pl.withdrawNoMatches(chosen.name) : pl.withdrawWalkovers(chosen.name, open.length)}
            </p>
            {running && <p>{pl.withdrawAbandons(lowerFirst(fixtureLabel(view.format, running)))}</p>}
            <p>{pl.withdrawFuture}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
            <WarningIcon className="shrink-0 text-(--color-accent)" />
            {error}
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="submit" disabled={saving || !chosen} className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
            {pl.withdrawPlayer}
          </button>
          <button type="button" disabled={saving} onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
            {pl.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
