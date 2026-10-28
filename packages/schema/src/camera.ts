import { z } from 'zod';

// Piksele obrazu z kamery: początek w lewym górnym rogu, y w dół, wartości ułamkowe dozwolone.
export const ImagePoint = z.object({ x: z.number(), y: z.number() });
export type ImagePoint = z.infer<typeof ImagePoint>;

export const CameraCalibration = z
  .object({
    imageWidth: z.int().positive(),
    imageHeight: z.int().positive(),
    // Zewnętrzna krawędź pierścienia double na granicach 5|20, 13|6, 17|3, 8|11, w tej kolejności.
    points: z.tuple([ImagePoint, ImagePoint, ImagePoint, ImagePoint]),
  })
  .refine(
    ({ imageWidth, imageHeight, points }) =>
      points.every(({ x, y }) => x >= 0 && x <= imageWidth && y >= 0 && y <= imageHeight),
    { message: 'Calibration points must lie inside the image', path: ['points'] },
  );
export type CameraCalibration = z.infer<typeof CameraCalibration>;
