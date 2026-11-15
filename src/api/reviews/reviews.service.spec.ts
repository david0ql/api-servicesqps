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

    const service = new ReviewsService(
      reviewItemsRepository as any,
      reviewsByServiceRepository as any,
      servicesRepository as any,
      usersRepository as any,
      notifier as any,
    );

    return {
      service,
      reviewsByServiceRepository,
      servicesRepository,
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
});
