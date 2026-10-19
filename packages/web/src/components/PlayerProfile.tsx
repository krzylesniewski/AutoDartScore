import type { Player } from '@autoscore/schema';
import { useState } from 'react';
import { updatePlayer } from '../api/client';
import { pl } from '../i18n/pl';
import { ArchivePlayerDialog } from './ArchivePlayerDialog';
import { Avatar } from './Avatar';
import { EditPlayerDialog } from './EditPlayerDialog';
import { ArchiveIcon, WarningIcon } from './icons';

export interface PlayerProfileProps {
  player: Player;
  colorIndex: number;
  onChanged(player: Player): void;
}

const button =
  'flex min-h-11 items-center rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 font-display text-[19px] font-semibold disabled:opacity-40';

export function PlayerProfile({ player, colorIndex, onChanged }: PlayerProfileProps) {
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
    <section aria-label={player.name} className="flex flex-wrap items-center gap-5 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) p-5">
      <Avatar name={player.name} avatar={player.avatar} colorIndex={colorIndex} size="large" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate font-display text-4xl font-bold">{player.name}</h2>
        {archived && <ArchivedBadge />}
        {error && (
          <p className="flex items-center gap-2 font-display text-lg text-(--color-accent)">
            <WarningIcon />
            {pl.updatePlayerFailed}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => setDialog('edit')} className={button}>
          {pl.editProfile}
        </button>
        {archived ? (
          <button type="button" disabled={busy} onClick={() => void setArchived(false)} className={button}>
            {pl.restore}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => setDialog('archive')} className={button}>
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
    <span className="flex w-fit shrink-0 items-center gap-1 rounded-(--radius-chip) border border-(--color-border-strong) px-1.5 font-display text-sm font-semibold text-(--color-text-muted) uppercase">
      <ArchiveIcon />
      {pl.archived}
    </span>
  );
}
