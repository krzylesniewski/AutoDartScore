import type { Player } from '@autoscore/schema';
import { useState } from 'react';
import { updatePlayer } from '../api/client';
import { pl } from '../i18n/pl';
import { ArchivePlayerDialog } from './ArchivePlayerDialog';
import { Avatar } from './Avatar';
import { CardRings } from './CardRings';
import { EditPlayerDialog } from './EditPlayerDialog';
import { ArchiveIcon, WarningIcon } from './icons';

export interface PlayerProfileProps {
  player: Player;
  onChanged(player: Player): void;
}

export function PlayerProfile({ player, onChanged }: PlayerProfileProps) {
  const [dialog, setDialog] = useState<'edit' | 'archive' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const archived = player.archivedAt !== null;

  async function setArchived(value: boolean): Promise<void> {
    setDialog(null);
    setBusy(true);
    setError(false);
    try {
      onChanged(await updatePlayer(player.id, { archived: value }));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={player.name} className="sc-panel min-h-29 flex-row flex-wrap items-center gap-5 py-4">
      <CardRings className="-top-22 right-10 size-65 sm:right-60" />
      <span className="relative flex shrink-0 rounded-full ring-4 ring-(--color-surface-raised)">
        <Avatar name={player.name} avatar={player.avatar} color={player.color} size="preview" />
      </span>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="truncate font-display text-[length:clamp(2.25rem,8vw,3.75rem)] leading-[0.95] font-black">{player.name}</h2>
        {archived && <ArchivedBadge />}
        {error && (
          <p className="flex items-center gap-2 font-display text-lg text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {pl.updatePlayerFailed}
          </p>
        )}
      </div>
      <div className="relative flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => setDialog('edit')} className="sc-btn">
          {pl.editProfile}
        </button>
        {archived ? (
          <button type="button" disabled={busy} onClick={() => void setArchived(false)} className="sc-btn sc-btn--outline sc-btn--quiet">
            <ArchiveIcon />
            {pl.restore}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => setDialog('archive')} className="sc-btn sc-btn--outline sc-btn--quiet">
            <ArchiveIcon />
            {pl.archive}
          </button>
        )}
      </div>
      {dialog === 'edit' && (
        <EditPlayerDialog
          player={player}
          onSaved={(saved) => {
            setDialog(null);
            onChanged(saved);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'archive' && <ArchivePlayerDialog name={player.name} onConfirm={() => void setArchived(true)} onCancel={() => setDialog(null)} />}
    </section>
  );
}

function ArchivedBadge() {
  return (
    <span className="flex w-fit shrink-0 items-center gap-2 rounded-(--radius-pill) bg-(--color-surface-soft) px-3 py-1 font-display text-[15px] font-bold text-(--color-text-sub)">
      <ArchiveIcon />
      {pl.archived}
    </span>
  );
}
