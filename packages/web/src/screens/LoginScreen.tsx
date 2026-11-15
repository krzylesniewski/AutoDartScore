import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, login } from '../api/client';
import { saveToken } from '../api/session';
import { AppMark } from '../components/AppMark';
import { CornerRings } from '../components/CornerRings';
import { WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const input = 'h-14 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-4 shadow-(--shadow-outline)';

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
  const errorId = useId();
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
    <main className="flex h-full items-center justify-center overflow-auto p-(--space-page) pt-[calc(var(--space-page)+env(safe-area-inset-top))] pb-[calc(var(--space-page)+env(safe-area-inset-bottom))]">
      <div className="relative flex w-full max-w-[460px] flex-col gap-7 overflow-hidden rounded-(--radius-panel) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) p-6 shadow-(--shadow-card) sm:p-8.5">
        <CornerRings className="-top-20 -right-20 size-65" />
        <h1 className="relative flex items-center gap-3.5 font-display text-[34px] leading-none font-extrabold tracking-[0.08em] uppercase">
          <AppMark className="size-11" />
          {pl.appName}
        </h1>
        <form onSubmit={(event) => void submit(event)} className="relative flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className={label}>{pl.password}</span>
            <input
              ref={passwordInput}
              type="password"
              autoComplete="current-password"
              maxLength={200}
              value={password}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setPassword(event.target.value)}
              className={`${input} text-[22px] aria-invalid:inset-ring-2 aria-invalid:inset-ring-(--color-accent)`}
            />
          </label>
          {error && (
            <p id={errorId} role="alert" className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
              <WarningIcon className="text-(--color-accent)" />
              {error}
            </p>
          )}
          <button type="submit" disabled={sending || password === ''} className="sc-btn sc-btn--primary mt-1.5 h-15 text-[26px]">
            {pl.logIn}
          </button>
        </form>
      </div>
    </main>
  );
}
