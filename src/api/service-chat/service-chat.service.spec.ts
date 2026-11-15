import moment from 'moment-timezone';

jest.mock('../../push-notification/push-notification.service', () => ({
  PushNotificationsService: class {},
}));
// page-meta.dto usa imports absolutos 'src/...' que jest no resuelve.
jest.mock('../../dto/page-meta.dto', () => ({
  PageMetaDto: class {
    constructor(public readonly params: unknown) {}
  },
}));

import { ServiceChatService } from './service-chat.service';

const createQueryBuilderMock = (result: { many?: any[]; rawMany?: any[]; rawOne?: any }) => {
  const qb: Record<string, jest.Mock> = {};
  const chain = [
    'leftJoin',
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'offset',
    'limit',
    'setParameters',
  ];
  for (const method of chain) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getQuery = jest.fn(() => 'SELECT 1');
  qb.getParameters = jest.fn(() => ({}));
  qb.getMany = jest.fn(async () => result.many ?? []);
  qb.getRawMany = jest.fn(async () => result.rawMany ?? []);
  qb.getRawOne = jest.fn(async () => result.rawOne ?? null);
  return qb;
};

describe('ServiceChatService', () => {
  const admin = { id: 'admin-1', name: 'Admin', roleId: '1' } as any;

  const createService = () => {
    const chatMessagesRepository = { createQueryBuilder: jest.fn() };
    const servicesRepository = {
      findOne: jest.fn(async () => ({
        id: 'service-1',
        statusId: '2',
        date: moment().format('YYYY-MM-DD'),
        userId: 'cleaner-1',
      })),
      createQueryBuilder: jest.fn(),
    };
    const usersRepository = { find: jest.fn(), findOne: jest.fn() };
    const pushNotificationsService = { sendNotification: jest.fn() };

    const service = new ServiceChatService(
      chatMessagesRepository as any,
      servicesRepository as any,
      usersRepository as any,
      pushNotificationsService as any,
    );

    return { service, chatMessagesRepository, servicesRepository };
  };

  it('returns chat history newest first with id as tiebreaker', async () => {
    const { service, chatMessagesRepository } = createService();
    const qb = createQueryBuilderMock({
      many: [
        { id: '3', serviceId: 'service-1', userId: 'admin-1', message: 'c', createdAt: new Date() },
        { id: '2', serviceId: 'service-1', userId: 'admin-1', message: 'b', createdAt: new Date() },
      ],
    });
    chatMessagesRepository.createQueryBuilder.mockReturnValue(qb);

    const history = await service.getChatHistory('service-1', admin);

    expect(qb.orderBy).toHaveBeenCalledWith('message.createdAt', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('message.id', 'DESC');
    expect(history.messages.map((m) => m.id)).toEqual(['3', '2']);
  });

  it('paginates chat threads with offset/limit (raw query) ordered DESC', async () => {
    const { service, chatMessagesRepository, servicesRepository } = createService();
    const countQb = createQueryBuilderMock({ rawOne: { count: '25' } });
    const subQb = createQueryBuilderMock({});
    chatMessagesRepository.createQueryBuilder
      .mockReturnValueOnce(countQb)
      .mockReturnValueOnce(subQb);
    const rowsQb = createQueryBuilderMock({ rawMany: [] });
    servicesRepository.createQueryBuilder.mockReturnValue(rowsQb);

    await service.getChatThreads({ page: 3, take: 10, skip: 20 } as any, admin);

    expect(rowsQb.orderBy).toHaveBeenCalledWith('message.createdAt', 'DESC');
    expect(rowsQb.addOrderBy).toHaveBeenCalledWith('message.id', 'DESC');
    expect(rowsQb.offset).toHaveBeenCalledWith(20);
    expect(rowsQb.limit).toHaveBeenCalledWith(10);
    expect(rowsQb.skip).not.toHaveBeenCalled();
    expect(rowsQb.take).not.toHaveBeenCalled();
  });
});
