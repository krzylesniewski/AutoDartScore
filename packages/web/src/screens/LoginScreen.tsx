import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, login } from '../api/client';
import { saveToken } from '../api/session';
import { TargetIcon, WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const button = 'flex h-(--button-height) items-center justify-center rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold disabled:opacity-40';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const input = 'min-h-12 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-bg) px-3 text-xl';

function errorText(caught: unknown): string {
  if (caught instanceof ApiRequestError && caught.status === 401) {
    return pl.invalidPassword;
  }
  if (caught instanceof ApiRequestError && caught.status === 429) {
    return pl.tooManyAttempts;
  }
  return pl.requestFailed;
}

export function LoginScreen({ onLoggedIn }: { onLoggedIn(): void }) {
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordInput.current?.focus();
  }, []);

  // Hasło idzie bez trim, bo spacje mogą być jego częścią.
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await login({ password });
      saveToken(response.token);
      onLoggedIn();
    } catch (caught) {
      setError(errorText(caught));
      setSending(false);
    }
  }

  return (
    // Boczne wcięcia ekranu dodaje już #root w theme.css.
    <main className="flex h-full items-center justify-center overflow-auto bg-(--color-bg) p-(--space-page) pt-[calc(var(--space-page)+env(safe-area-inset-top))] pb-[calc(var(--space-page)+env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface) p-6">
        <h1 className="flex items-center gap-3 font-display text-(length:--text-heading) font-bold tracking-wide">
          <TargetIcon className="text-(--color-accent)" />
          {pl.appName}
        </h1>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className={label}>{pl.password}</span>
            <input
              ref={passwordInput}
              type="password"
              autoComplete="current-password"
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={input}
            />
          </label>
          {error && (
            <p role="alert" className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
              <WarningIcon />
              {error}
            </p>
          )}
          <button type="submit" disabled={sending || password === ''} className={`${button} border-(--color-text) bg-(--color-text) text-(--color-text-inverse)`}>
            {pl.logIn}
          </button>
        </form>
      </div>
    </main>
  );
}
