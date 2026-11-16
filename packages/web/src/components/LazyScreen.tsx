import { Component, type ReactNode, Suspense } from 'react';
import { pl } from '../i18n/pl';
import { Notice } from './Notice';

export interface LazyScreenProps {
  children: ReactNode;
  onReload?: () => void;
}

interface LoadBoundaryState {
  failed: boolean;
}

function reloadPage() {
  window.location.reload();
}

// Po wdrożeniu otwarta karta prosi o pliki ekranu ze starymi nazwami, których już nie ma. Pomaga tylko odświeżenie strony.
class LoadBoundary extends Component<{ children: ReactNode; onReload: () => void }, LoadBoundaryState> {
  override state: LoadBoundaryState = { failed: false };

  static getDerivedStateFromError(): LoadBoundaryState {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <Notice text={pl.screenLoadFailed}>
          <button type="button" className="sc-btn sc-btn--outline" onClick={this.props.onReload}>
            {pl.reloadPage}
          </button>
        </Notice>
      );
    }
    return this.props.children;
  }
}

// Ekran wczytywany na żądanie: komunikat w trakcie ładowania i błąd z odświeżeniem, gdy kod ekranu się nie wczyta.
export function LazyScreen({ children, onReload = reloadPage }: LazyScreenProps) {
  return (
    <LoadBoundary onReload={onReload}>
      <Suspense
        fallback={
          <p role="status" className="font-display text-(--color-text-muted)">
            {pl.loading}
          </p>
        }
      >
        {children}
      </Suspense>
    </LoadBoundary>
  );
}
