import { afterEach, describe, expect, it } from 'vitest';
import { isOtherControl } from './shortcut-target';

function mount(html: string): void {
  document.body.innerHTML = html;
}

function byId(id: string): Element {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`no #${id}`);
  }
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isOtherControl', () => {
  it('is true for a button outside the shortcut keys', () => {
    mount('<button id="voice">Głos</button>');
    expect(isOtherControl(byId('voice'))).toBe(true);
  });

  it('is false for a button inside the shortcut keys', () => {
    mount('<section data-shortcut-keys=""><button id="key">20</button></section>');
    expect(isOtherControl(byId('key'))).toBe(false);
  });

  it('is false for the body, the document and the window', () => {
    expect(isOtherControl(document.body)).toBe(false);
    expect(isOtherControl(document)).toBe(false);
    expect(isOtherControl(window)).toBe(false);
    expect(isOtherControl(null)).toBe(false);
  });

  it('is false for a non-interactive element', () => {
    mount('<div id="plain">tekst</div>');
    expect(isOtherControl(byId('plain'))).toBe(false);
  });

  it('is true for a switch role', () => {
    mount('<div id="switch" role="switch" tabindex="0"></div>');
    expect(isOtherControl(byId('switch'))).toBe(true);
  });

  it('is true for a span inside a button', () => {
    mount('<button><span id="label">Tury</span></button>');
    expect(isOtherControl(byId('label'))).toBe(true);
  });

  it('is true for a link with an href only', () => {
    mount('<a id="link" href="#/">Start</a><a id="anchor">bez celu</a>');
    expect(isOtherControl(byId('link'))).toBe(true);
    expect(isOtherControl(byId('anchor'))).toBe(false);
  });
});
