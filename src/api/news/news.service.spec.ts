jest.mock('../../push-notification/push-notification.service', () => ({
  PushNotificationsService: class { },
}));
// page-meta.dto usa un import absoluto 'src/...' que jest no resuelve.
jest.mock('../../dto/page-meta.dto', () => ({
  PageMetaDto: class {
    totalCount: number;
    constructor({ totalCount }: { totalCount: number }) { this.totalCount = totalCount; }
  },
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { isNewsVisibleForRole, NewsService } from './news.service';

const VALID_TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const VALID_TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

const admin = { id: 'admin-1', roleId: '1' };
const cleaner = { id: 'cleaner-1', roleId: '4' };

const createQueryBuilderMock = (result: { many?: any[]; count?: number }) => {
  const qb: any = {};
  ['select', 'where', 'andWhere', 'orWhere', 'leftJoin', 'orderBy', 'addOrderBy', 'skip', 'take'].forEach((method) => {
    qb[method] = jest.fn(() => qb);
  });
  qb.getMany = jest.fn(async () => result.many ?? []);
  qb.getManyAndCount = jest.fn(async () => [result.many ?? [], result.count ?? (result.many ?? []).length]);
  return qb;
};

const createService = () => {
  const newsRepository = {
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 'news-1', ...payload })),
    findOne: jest.fn(),
    findAndCount: jest.fn(async () => [[], 0]),
    remove: jest.fn(async (payload) => payload),
    createQueryBuilder: jest.fn(),
  };
  const newsReadsRepository = {
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: 'read-1', ...payload })),
    findOne: jest.fn(async () => null),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => createQueryBuilderMock({ many: [] })),
  };
  const usersQb = createQueryBuilderMock({ many: [] });
  const usersRepository = {
    createQueryBuilder: jest.fn(() => usersQb),
  };
  const pushNotificationsService = {
    sendNotification: jest.fn(async () => ({ done: true })),
  };

  const service = new NewsService(
    newsRepository as any,
    newsReadsRepository as any,
    usersRepository as any,
    pushNotificationsService as any,
  );

  return { service, newsRepository, newsReadsRepository, usersQb, pushNotificationsService };
};

describe('isNewsVisibleForRole', () => {
  it('treats null or empty audience as all users', () => {
    expect(isNewsVisibleForRole(null, '4')).toBe(true);
    expect(isNewsVisibleForRole([], '4')).toBe(true);
  });

  it('restricts to listed roles', () => {
    expect(isNewsVisibleForRole(['4', '7'], '4')).toBe(true);
    expect(isNewsVisibleForRole(['7'], '4')).toBe(false);
    expect(isNewsVisibleForRole(['7'], null)).toBe(false);
  });
});

describe('NewsService', () => {
  it('rejects create for non admin users', async () => {
    const { service } = createService();

    await expect(service.create({ title: 'T', body: 'B' }, cleaner)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a draft without sending push', async () => {
    const { service, newsRepository, pushNotificationsService } = createService();

    const saved = await service.create({ title: 'Hello', body: 'World', audienceRoles: [] }, admin);

    expect(newsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      isPublished: false,
      publishedAt: null,
      audienceRoles: null,
      createdByUserId: 'admin-1',
    }));
    expect(saved.isPublished).toBe(false);
    expect(pushNotificationsService.sendNotification).not.toHaveBeenCalled();
  });

  it('on publish sends push only to audience users with valid Expo tokens and never SMS', async () => {
    const { service, usersQb, pushNotificationsService } = createService();
    usersQb.getMany.mockResolvedValue([
      { id: 'u1', roleId: '4', token: VALID_TOKEN_A },
      { id: 'u2', roleId: '7', token: VALID_TOKEN_B },
      { id: 'u3', roleId: '4', token: 'not-a-token' },
      { id: 'u4', roleId: '4', token: VALID_TOKEN_A },
    ]);

    await service.create({ title: 'Big news', body: 'Read this', isPublished: true, audienceRoles: ['4'] }, admin);

    expect(pushNotificationsService.sendNotification).toHaveBeenCalledTimes(1);
    const payload = (pushNotificationsService.sendNotification.mock.calls[0] as any[])[0];
    expect(payload.skipSms).toBe(true);
    expect(payload.tokensNotification.users).toEqual([]);
    expect(payload.tokensNotification.tokens).toEqual([VALID_TOKEN_A]);
    expect(payload.data).toEqual({ type: 'news', newsId: 'news-1' });
  });

  it('only notifies on the first publish', async () => {
    const { service, newsRepository, usersQb, pushNotificationsService } = createService();
    usersQb.getMany.mockResolvedValue([{ id: 'u1', roleId: '4', token: VALID_TOKEN_A }]);

    newsRepository.findOne.mockResolvedValueOnce({
      id: 'news-2', title: 'T', body: 'B', isPublished: false, publishedAt: null, audienceRoles: null,
    });
    const published = await service.update('news-2', { isPublished: true }, admin);
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(pushNotificationsService.sendNotification).toHaveBeenCalledTimes(1);

    newsRepository.findOne.mockResolvedValueOnce({
      id: 'news-2', title: 'T', body: 'B', isPublished: false, publishedAt: new Date('2026-01-01'), audienceRoles: null,
    });
    await service.update('news-2', { isPublished: true }, admin);
    expect(pushNotificationsService.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('does not fail the publish when push sending throws', async () => {
    const { service, usersQb, pushNotificationsService } = createService();
    usersQb.getMany.mockResolvedValue([{ id: 'u1', roleId: '4', token: VALID_TOKEN_A }]);
    pushNotificationsService.sendNotification.mockRejectedValueOnce(new Error('expo down'));

    await expect(service.create({ title: 'T', body: 'B', isPublished: true }, admin)).resolves.toBeDefined();
  });

  it('accept rejects unpublished or out-of-audience news', async () => {
    const { service, newsRepository } = createService();

    newsRepository.findOne.mockResolvedValueOnce({ id: 'n', isPublished: false, audienceRoles: null });
    await expect(service.accept('n', cleaner)).rejects.toBeInstanceOf(NotFoundException);

    newsRepository.findOne.mockResolvedValueOnce({ id: 'n', isPublished: true, audienceRoles: ['7'] });
    await expect(service.accept('n', cleaner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accept is idempotent', async () => {
    const { service, newsRepository, newsReadsRepository } = createService();
    const acceptedAt = new Date('2026-02-02');

    newsRepository.findOne.mockResolvedValue({ id: 'n', isPublished: true, audienceRoles: null });
    newsReadsRepository.findOne.mockResolvedValueOnce({ id: 'r', newsId: 'n', userId: 'cleaner-1', acceptedAt });

    await expect(service.accept('n', cleaner)).resolves.toEqual({ newsId: 'n', acceptedAt });
    expect(newsReadsRepository.save).not.toHaveBeenCalled();

    await service.accept('n', cleaner);
    expect(newsReadsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ newsId: 'n', userId: 'cleaner-1' }));
  });

  it('unread query excludes accepted news and maps read=false', async () => {
    const { service, newsRepository } = createService();
    const qb = createQueryBuilderMock({
      many: [{ id: 'n1', title: 'T', body: 'B', imageUrl: null, publishedAt: new Date(), audienceRoles: null }],
    });
    newsRepository.createQueryBuilder.mockReturnValue(qb);

    const unread = await service.findUnreadForUser(cleaner);

    expect(qb.leftJoin).toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith('newsRead.id IS NULL');
    expect(unread).toEqual([expect.objectContaining({ id: 'n1', read: false, acceptedAt: null })]);
  });

  it('published list marks read news', async () => {
    const { service, newsRepository, newsReadsRepository } = createService();
    const acceptedAt = new Date('2026-03-03');
    newsRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock({
      many: [
        { id: 'n1', title: 'A', body: 'a', imageUrl: null, publishedAt: new Date() },
        { id: 'n2', title: 'B', body: 'b', imageUrl: '/uploads/news/x.jpg', publishedAt: new Date() },
      ],
      count: 2,
    }));
    newsReadsRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock({
      many: [{ newsId: 'n2', userId: 'cleaner-1', acceptedAt }],
    }));

    const page = await service.findPublishedForUser({ page: 1, take: 10, skip: 0 } as any, cleaner);

    expect(page.data.map((item) => item.read)).toEqual([false, true]);
    expect(page.data[1].acceptedAt).toBe(acceptedAt);
    expect(page.meta.totalCount).toBe(2);
  });
});
