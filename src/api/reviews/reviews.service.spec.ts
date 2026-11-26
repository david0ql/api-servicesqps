jest.mock('../../config/env', () => ({ __esModule: true, default: {} }));

import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const createService = (serviceOverrides: Record<string, any> = {}) => {
    const reviewItemsRepository = {
      createQueryBuilder: jest.fn(),
    };
    const reviewsByServiceRepository = {
      findOne: jest.fn(async () => null),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => ({ id: 'review-1', ...payload })),
    };
    const servicesRepository = {
      findOne: jest.fn(async () => ({
        id: 'service-1',
        statusId: '5',
        startedAt: new Date('2026-11-10T13:00:00.000Z'),
        finishedAt: new Date('2026-11-10T15:00:00.000Z'),
        refreshCount: 0,
        refreshHistory: null,
        community: { communityName: 'Test Community' },
        user: { id: 'cleaner-1' },
        ...serviceOverrides,
      })),
      update: jest.fn(),
    };
    const usersRepository = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };
    const notifier = {
      notificar: jest.fn(),
    };
    const refreshPhotosRepository = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
    };

    const service = new ReviewsService(
      reviewItemsRepository as any,
      reviewsByServiceRepository as any,
      servicesRepository as any,
      usersRepository as any,
      notifier as any,
      refreshPhotosRepository as any,
    );

    return {
      service,
      reviewsByServiceRepository,
      servicesRepository,
      usersRepository,
      refreshPhotosRepository,
      notifier,
    };
  };

  const review = (value: boolean) => ({
    serviceId: 'service-1',
    message: 'QA custom message',
    reviewItems: [{ reviewItemId: 'item-1', value }],
  });

  it('updates service status without overwriting the existing comment after QA review', async () => {
    const { service, servicesRepository } = createService();

    await service.createServiceReview(review(true));

    expect(servicesRepository.update).toHaveBeenCalledWith(
      'service-1',
      expect.objectContaining({
        statusId: '3',
      }),
    );
    expect(servicesRepository.update.mock.calls[0][1]).not.toHaveProperty('comment');
  });

  it('on refresh resets start/finish so the cleaner can redo it, keeping the previous attempt', async () => {
    const { service, servicesRepository, notifier } = createService();

    await service.createServiceReview(review(true), { id: '82', roleId: '7' } as any);

    const update = servicesRepository.update.mock.calls[0][1];
    expect(update).toMatchObject({
      statusId: '3',
      startedAt: null,
      finishedAt: null,
      refreshCount: 1,
      lastStartedAt: new Date('2026-11-10T13:00:00.000Z'),
      lastFinishedAt: new Date('2026-11-10T15:00:00.000Z'),
    });
    expect(JSON.parse(update.refreshHistory)[0].qaUserId).toBe('82');
    expect(notifier.notificar).toHaveBeenCalledWith('refresh', expect.anything());
  });

  it('does not count a second refresh while the service is still pending the redo', async () => {
    const { service, servicesRepository } = createService({
      statusId: '3',
      startedAt: null,
      finishedAt: null,
      refreshCount: 1,
    });

    await service.createServiceReview(review(true));

    const update = servicesRepository.update.mock.calls[0][1];
    expect(update.statusId).toBe('3');
    expect(update).not.toHaveProperty('refreshCount');
    expect(update).not.toHaveProperty('startedAt');
  });

  it('a passing review finishes the service and keeps the checkpoints', async () => {
    const { service, servicesRepository, notifier } = createService();

    await service.createServiceReview(review(false));

    const update = servicesRepository.update.mock.calls[0][1];
    expect(update.statusId).toBe('6');
    expect(update).not.toHaveProperty('startedAt');
    expect(update).not.toHaveProperty('refreshCount');
    expect(notifier.notificar).toHaveBeenCalledWith('finalizado', expect.anything());
  });

  describe('refresh por fotos', () => {
    const photoReview = (refreshPhotos: string[], extra: Record<string, any> = {}) => ({
      serviceId: 'service-1',
      message: 'Baño sucio',
      refreshPhotos,
      ...extra,
    });

    it('with photos sends the service to refresh and stores the photos as round 1', async () => {
      const { service, servicesRepository, refreshPhotosRepository, reviewsByServiceRepository, notifier } = createService();

      await service.createServiceReview(
        photoReview(['/uploads/service-refresh/a.jpg', '/uploads/service-refresh/b.jpg']) as any,
        { id: '82', roleId: '7' } as any,
      );

      const update = servicesRepository.update.mock.calls[0][1];
      expect(update).toMatchObject({ statusId: '3', startedAt: null, finishedAt: null, refreshCount: 1, refreshPhotosCount: 2 });
      expect(reviewsByServiceRepository.save).not.toHaveBeenCalled();
      expect(refreshPhotosRepository.save).toHaveBeenCalledWith([
        { serviceId: 'service-1', round: 1, photoPath: '/uploads/service-refresh/a.jpg', createdByUserId: '82', message: 'Baño sucio' },
        { serviceId: 'service-1', round: 1, photoPath: '/uploads/service-refresh/b.jpg', createdByUserId: '82', message: 'Baño sucio' },
      ]);
      expect(notifier.notificar).toHaveBeenCalledWith('refresh', expect.anything());
    });

    it('numbers the next round after the last stored one and dedupes photos', async () => {
      const { service, refreshPhotosRepository } = createService();
      refreshPhotosRepository.findOne.mockResolvedValueOnce({ id: '9', round: 2 } as any);

      await service.createServiceReview(
        photoReview(['/uploads/service-refresh/a.jpg', '/uploads/service-refresh/a.jpg']) as any,
        { id: '82', roleId: '7' } as any,
      );

      const saved = refreshPhotosRepository.save.mock.calls[0][0] as any[];
      expect(saved).toHaveLength(1);
      expect(saved[0].round).toBe(3);
    });

    it('photos win over a legacy checklist that is all OK', async () => {
      const { service, servicesRepository } = createService();

      await service.createServiceReview(
        photoReview(['/uploads/service-refresh/a.jpg'], { reviewItems: [{ reviewItemId: 'item-1', value: false }] }) as any,
      );

      expect(servicesRepository.update.mock.calls[0][1].statusId).toBe('3');
    });

    it('approves when there are no photos and no checklist', async () => {
      const { service, servicesRepository, refreshPhotosRepository, notifier } = createService();

      await service.createServiceReview({ serviceId: 'service-1' } as any);

      const update = servicesRepository.update.mock.calls[0][1];
      expect(update.statusId).toBe('6');
      expect(update.refreshPhotosCount).toBe(0);
      expect(update).not.toHaveProperty('startedAt');
      expect(refreshPhotosRepository.save).not.toHaveBeenCalled();
      expect(notifier.notificar).toHaveBeenCalledWith('finalizado', expect.anything());
    });

    it('rejects photo paths that did not come from the upload endpoint', async () => {
      const { service, servicesRepository } = createService();

      await expect(
        service.createServiceReview(photoReview(['/uploads/news/x.jpg']) as any),
      ).rejects.toThrow('Invalid refresh photo path');
      await expect(
        service.createServiceReview(photoReview(['/uploads/service-refresh/../../etc/passwd']) as any),
      ).rejects.toThrow('Invalid refresh photo path');
      expect(servicesRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getRefreshPhotos', () => {
    const rows = [
      { id: '1', round: 1, photoPath: '/uploads/service-refresh/a.jpg', createdByUserId: '82', message: 'r1', createdAt: new Date('2026-11-10T16:00:00.000Z') },
      { id: '2', round: 1, photoPath: '/uploads/service-refresh/b.jpg', createdByUserId: '82', message: 'r1', createdAt: new Date('2026-11-10T16:00:00.000Z') },
      { id: '3', round: 2, photoPath: '/uploads/service-refresh/c.jpg', createdByUserId: null, message: null, createdAt: new Date('2026-11-11T16:00:00.000Z') },
    ];

    it('groups photos by round, newest round first, with the QA user', async () => {
      const { service, refreshPhotosRepository, usersRepository } = createService({ userId: 'cleaner-1' });
      refreshPhotosRepository.find.mockResolvedValueOnce(rows as any);
      usersRepository.find.mockResolvedValueOnce([{ id: '82', name: 'QA Ana' }] as any);

      const result = await service.getRefreshPhotos('service-1', { id: 'cleaner-1', roleId: '4' } as any);

      expect(result.rounds.map(r => r.round)).toEqual([2, 1]);
      expect(result.rounds[0]).toEqual({
        round: 2,
        createdAt: '2026-11-11T16:00:00.000Z',
        qaUser: null,
        message: null,
        photos: [{ id: '3', url: '/uploads/service-refresh/c.jpg' }],
      });
      expect(result.rounds[1].qaUser).toEqual({ id: '82', name: 'QA Ana' });
      expect(result.rounds[1].photos.map(p => p.id)).toEqual(['1', '2']);
    });

    it('does not let a cleaner see photos of a service assigned to someone else', async () => {
      const { service } = createService({ userId: 'cleaner-1' });

      await expect(
        service.getRefreshPhotos('service-1', { id: 'cleaner-2', roleId: '4' } as any),
      ).rejects.toThrow('not allowed');
    });

    it('lets QA, admins and supervisors see them', async () => {
      for (const roleId of ['1', '9', '7', '3', '6']) {
        const { service } = createService({ userId: 'cleaner-1' });
        await expect(service.getRefreshPhotos('service-1', { id: 'x', roleId } as any)).resolves.toEqual({ rounds: [] });
      }
    });

    it('returns 404 when the service does not exist', async () => {
      const { service, servicesRepository } = createService();
      servicesRepository.findOne.mockResolvedValueOnce(null as any);

      await expect(service.getRefreshPhotos('nope', { id: '1', roleId: '1' } as any)).rejects.toThrow('not found');
    });
  });
});
