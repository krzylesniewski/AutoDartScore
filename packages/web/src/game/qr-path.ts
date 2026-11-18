import { encode } from 'uqr';

export interface QrPath {
  // Bok kodu w modułach, razem z marginesem 4 modułów, który czytnik potrzebuje wokół kodu.
  readonly size: number;
  // Ciemne moduły jako jedna ścieżka SVG. Sąsiednie moduły w wierszu łączą się w jeden prostokąt.
  readonly path: string;
}

// Kod liczy się w przeglądarce, więc adres nie trafia do żadnej zewnętrznej usługi.
export function qrPath(text: string): QrPath {
  const { size, data } = encode(text, { ecc: 'M', border: 4 });
  const parts: string[] = [];
  data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) {
        x += 1;
      }
      const run = x - start;
      parts.push(`M${start} ${y}h${run}v1h-${run}z`);
    }
  });
  return { size, path: parts.join('') };
}
