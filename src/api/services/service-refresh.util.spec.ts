import { ServiceStatusId } from '../../constants/service-status.enum';
import { buildRefreshResetUpdate, parseRefreshHistory, shouldResetForRefresh } from './service-refresh.util';

describe('service-refresh.util', () => {
  const startedAt = new Date('2026-11-10T13:00:00.000Z');
  const finishedAt = new Date('2026-11-10T15:30:00.000Z');
  const now = new Date('2026-11-11T12:00:00.000Z');

  const base = {
    statusId: ServiceStatusId.Completed,
    startedAt,
    finishedAt,
    startLatitude: '28.4100000',
    startLongitude: '-81.5300000',
    finishLatitude: '28.4100100',
    finishLongitude: '-81.5300100',
    refreshCount: 0,
    refreshHistory: null,
    qaUserId: '82',
  };

  describe('shouldResetForRefresh', () => {
    it('resets completed, finished or already-finished services', () => {
      expect(shouldResetForRefresh({ statusId: ServiceStatusId.Completed, finishedAt: null })).toBe(true);
      expect(shouldResetForRefresh({ statusId: ServiceStatusId.Finished, finishedAt: null })).toBe(true);
      expect(shouldResetForRefresh({ statusId: ServiceStatusId.Approved, finishedAt })).toBe(true);
    });

    it('does not reset a service already in refresh that has not been finished again', () => {
      expect(shouldResetForRefresh({ statusId: ServiceStatusId.Approved, finishedAt: null })).toBe(false);
    });
  });

  describe('buildRefreshResetUpdate', () => {
    it('keeps the previous attempt and clears start/finish checkpoints', () => {
      const update = buildRefreshResetUpdate(base, now, '90');

      expect(update.refreshCount).toBe(1);
      expect(update.lastRefreshedAt).toBe(now);
      expect(update.lastStartedAt).toBe(startedAt);
      expect(update.lastFinishedAt).toBe(finishedAt);

      for (const key of [
        'startedAt', 'startLatitude', 'startLongitude', 'startAccuracy', 'startAltitude',
        'startAltitudeAccuracy', 'startHeading', 'startSpeed', 'startLocationMeta',
        'finishedAt', 'finishLatitude', 'finishLongitude', 'finishAccuracy', 'finishAltitude',
        'finishAltitudeAccuracy', 'finishHeading', 'finishSpeed', 'finishLocationMeta',
      ]) {
        expect(update).toHaveProperty(key, null);
      }

      expect(update).not.toHaveProperty('statusId');

      const history = parseRefreshHistory(update.refreshHistory);
      expect(history).toEqual([
        {
          refreshedAt: now.toISOString(),
          qaUserId: '90',
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          startLatitude: '28.4100000',
          startLongitude: '-81.5300000',
          finishLatitude: '28.4100100',
          finishLongitude: '-81.5300100',
        },
      ]);
    });

    it('appends to the existing history and increments the counter', () => {
      const first = buildRefreshResetUpdate(base, now);
      const second = buildRefreshResetUpdate(
        { ...base, refreshCount: first.refreshCount!, refreshHistory: first.refreshHistory! },
        new Date('2026-11-12T12:00:00.000Z'),
      );

      expect(second.refreshCount).toBe(2);
      const history = parseRefreshHistory(second.refreshHistory);
      expect(history).toHaveLength(2);
      expect(history[0].qaUserId).toBe('82');
      expect(history[1].refreshedAt).toBe('2026-11-12T12:00:00.000Z');
    });

    it('tolerates corrupt history and string counters from MySQL', () => {
      const update = buildRefreshResetUpdate(
        { ...base, refreshCount: '3' as any, refreshHistory: '{not json' },
        now,
      );
      expect(update.refreshCount).toBe(4);
      expect(parseRefreshHistory(update.refreshHistory)).toHaveLength(1);
    });
  });
});
