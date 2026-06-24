import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const createService = () => {
    const reviewItemsRepository = {
      createQueryBuilder: jest.fn(),
    };
    const reviewsByServiceRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => ({ id: 'review-1', ...payload })),
    };
    const servicesRepository = {
      findOne: jest.fn(async () => ({
        id: 'service-1',
        community: { communityName: 'Test Community' },
        user: { id: 'cleaner-1' },
      })),
      update: jest.fn(),
    };
    const usersRepository = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };
    const pushNotificationsService = {
      sendNotification: jest.fn(),
    };

    const service = new ReviewsService(
      reviewItemsRepository as any,
      reviewsByServiceRepository as any,
      servicesRepository as any,
      usersRepository as any,
      pushNotificationsService as any,
    );

    return {
      service,
      reviewsByServiceRepository,
      servicesRepository,
      pushNotificationsService,
    };
  };

  it('updates service status without overwriting the existing comment after QA review', async () => {
    const {
      service,
      reviewsByServiceRepository,
      servicesRepository,
    } = createService();

    reviewsByServiceRepository.findOne.mockResolvedValue(null);

    await service.createServiceReview({
      serviceId: 'service-1',
      message: 'QA custom message',
      reviewItems: [
        {
          reviewItemId: 'item-1',
          value: true,
        },
      ],
    });

    expect(servicesRepository.update).toHaveBeenCalledWith(
      'service-1',
      expect.objectContaining({
        statusId: '3',
      }),
    );
    expect(servicesRepository.update.mock.calls[0][1]).not.toHaveProperty('comment');
  });
});
