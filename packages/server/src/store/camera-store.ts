import type { CameraCalibration } from '@autoscore/schema';
import type { Kysely, Selectable } from 'kysely';
import type { CameraCalibrationsTable, Database } from '../db/database.js';

// Tylko dopisywanie, jak player_changes: każdy zapis to nowy wiersz z kolejnym seq, a aktualny ma najwyższy.
export interface CameraStore {
  saveCalibration(cameraId: string, calibration: CameraCalibration, now: number): Promise<CameraCalibration>;
  findCalibration(cameraId: string): Promise<CameraCalibration | null>;
}

export function createCameraStore(db: Kysely<Database>): CameraStore {
  return {
    async saveCalibration(cameraId, calibration, now) {
      const [p1, p2, p3, p4] = calibration.points;
      await db.transaction().execute(async (trx) => {
        const last = await trx
          .selectFrom('camera_calibrations')
          .select((eb) => eb.fn.max('seq').as('seq'))
          .where('camera_id', '=', cameraId)
          .executeTakeFirst();
        await trx
          .insertInto('camera_calibrations')
          .values({
            camera_id: cameraId,
            seq: Number(last?.seq ?? 0) + 1,
            image_width: calibration.imageWidth,
            image_height: calibration.imageHeight,
            p1_x: p1.x,
            p1_y: p1.y,
            p2_x: p2.x,
            p2_y: p2.y,
            p3_x: p3.x,
            p3_y: p3.y,
            p4_x: p4.x,
            p4_y: p4.y,
            created_at: new Date(now).toISOString(),
          })
          .execute();
      });
      return calibration;
    },

    async findCalibration(cameraId) {
      const row = await db
        .selectFrom('camera_calibrations')
        .selectAll()
        .where('camera_id', '=', cameraId)
        .orderBy('seq', 'desc')
        .limit(1)
        .executeTakeFirst();
      return row ? toCalibration(row) : null;
    },
  };
}

function toCalibration(row: Selectable<CameraCalibrationsTable>): CameraCalibration {
  return {
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    points: [
      { x: row.p1_x, y: row.p1_y },
      { x: row.p2_x, y: row.p2_y },
      { x: row.p3_x, y: row.p3_y },
      { x: row.p4_x, y: row.p4_y },
    ],
  };
}
