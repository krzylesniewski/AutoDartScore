import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Globale Vitesta są wyłączone, więc Testing Library nie sprząta DOM-u sama.
afterEach(cleanup);

// jsdom nie ma metod <dialog> ani top layer, więc showModal() i close() tylko przełączają open.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
