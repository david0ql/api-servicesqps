import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Expo } from 'expo-server-sdk';

import { NewsAudienceUser, NewsEntity } from '../../entities/news.entity';
import { NewsReadsEntity } from '../../entities/news_reads.entity';
import { UsersEntity } from '../../entities/users.entity';
import { PushNotificationsService } from '../../push-notification/push-notification.service';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';
import { SearchDto } from '../../dto/search.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

/** Roles que administran Last News: super admin ('1') y, si existe, '9'. */
export const NEWS_ADMIN_ROLE_IDS = new Set<string>(['1', '9']);

const PUSH_BODY_MAX_LENGTH = 140;

export interface NewsForUser {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  read: boolean;
  acceptedAt: Date | null;
}

type CurrentUser = Pick<UsersEntity, 'id' | 'roleId'>;

export const isNewsAdmin = (user?: Pick<UsersEntity, 'roleId'> | null) =>
  Boolean(user?.roleId && NEWS_ADMIN_ROLE_IDS.has(String(user.roleId)));

/**
 * Quién ve la noticia:
 * - sin roles ni usuarios: todos;
 * - usuario elegido explícitamente: sí;
 * - rol incluido y SIN usuarios elegidos de ese rol: todo el rol;
 * - rol incluido CON usuarios elegidos de ese rol: solo esos usuarios.
 */
export const isNewsVisibleFor = (
  audienceRoles: string[] | null | undefined,
  audienceUsers: NewsAudienceUser[] | null | undefined,
  user: { id?: string | null; roleId?: string | null },
) => {
  const roles = (audienceRoles ?? []).map(String);
  const users = audienceUsers ?? [];
  if (roles.length === 0 && users.length === 0) return true;
  if (user.id && users.some((u) => String(u.id) === String(user.id))) return true;
  if (!user.roleId) return false;
  const role = String(user.roleId);
  return roles.includes(role) && !users.some((u) => String(u.roleId) === role);
};

/** Compatibilidad: visibilidad solo por rol (sin usuarios específicos). */
export const isNewsVisibleForRole = (
  audienceRoles: string[] | null | undefined,
  roleId: string | null | undefined,
) => isNewsVisibleFor(audienceRoles, null, { roleId });

const normalizeAudience = (audienceRoles?: string[] | null) => {
  if (!audienceRoles) return null;
  const unique = Array.from(new Set(audienceRoles.map((role) => String(role).trim()).filter(Boolean)));
  return unique.length > 0 ? unique : null;
};

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    @InjectRepository(NewsEntity)
    private readonly newsRepository: Repository<NewsEntity>,
    @InjectRepository(NewsReadsEntity)
    private readonly newsReadsRepository: Repository<NewsReadsEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) { }

  /**
   * Normaliza la audiencia: los usuarios elegidos se guardan con su rol (de la BD)
   * y sus roles se agregan a audienceRoles. Vacío = null.
   */
  private async resolveAudience(audienceRoles?: string[] | null, audienceUserIds?: string[] | null) {
    const roles = new Set(normalizeAudience(audienceRoles) ?? []);
    const ids = Array.from(new Set((audienceUserIds ?? []).map((id) => String(id).trim()).filter(Boolean)));
    let audienceUsers: NewsAudienceUser[] | null = null;
    if (ids.length) {
      const users = await this.usersRepository.find({ where: ids.map((id) => ({ id })), select: ['id', 'roleId'] });
      audienceUsers = users.map((u) => ({ id: String(u.id), roleId: String(u.roleId) }));
      audienceUsers.forEach((u) => roles.add(u.roleId));
      if (!audienceUsers.length) audienceUsers = null;
    }
    return { audienceRoles: roles.size ? Array.from(roles) : null, audienceUsers };
  }

  assertAdmin(user?: CurrentUser | null) {
    if (!isNewsAdmin(user)) {
      throw new ForbiddenException('Only administrators can manage news.');
    }
  }

  // ---------------------------------------------------------------- Admin

  async create(createNewsDto: CreateNewsDto, currentUser: CurrentUser) {
    this.assertAdmin(currentUser);

    const shouldPublish = Boolean(createNewsDto.isPublished);
    const news = this.newsRepository.create({
      title: createNewsDto.title,
      body: createNewsDto.body,
      imageUrl: createNewsDto.imageUrl || null,
      ...(await this.resolveAudience(createNewsDto.audienceRoles, createNewsDto.audienceUserIds)),
      isPublished: shouldPublish,
      publishedAt: shouldPublish ? new Date() : null,
      createdByUserId: currentUser.id,
    });

    const saved = await this.newsRepository.save(news);

    if (shouldPublish) {
      await this.notifyPublished(saved);
    }

    return saved;
  }

  async findAllAdmin(pageOptionsDto: PageOptionsDto, currentUser: CurrentUser): Promise<PageDto<NewsEntity>> {
    this.assertAdmin(currentUser);

    const [items, totalCount] = await this.newsRepository.findAndCount({
      order: { createdAt: pageOptionsDto.order ?? 'DESC' },
      skip: pageOptionsDto.skip,
      take: pageOptionsDto.take,
    });

    return new PageDto(items, new PageMetaDto({ totalCount, pageOptionsDto }));
  }

  async searchAdmin(searchDto: SearchDto, pageOptionsDto: PageOptionsDto, currentUser: CurrentUser): Promise<PageDto<NewsEntity>> {
    this.assertAdmin(currentUser);

    const [items, totalCount] = await this.newsRepository.createQueryBuilder('news')
      .where('news.title LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('news.body LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orderBy('news.createdAt', pageOptionsDto.order ?? 'DESC')
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .getManyAndCount();

    return new PageDto(items, new PageMetaDto({ totalCount, pageOptionsDto }));
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const news = await this.newsRepository.findOne({ where: { id } });

    if (!news) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }

    if (!isNewsAdmin(currentUser)
      && (!news.isPublished || !isNewsVisibleFor(news.audienceRoles, news.audienceUsers, currentUser))) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }

    return news;
  }

  async update(id: string, updateNewsDto: UpdateNewsDto, currentUser: CurrentUser) {
    this.assertAdmin(currentUser);

    const news = await this.newsRepository.findOne({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }

    // Solo se notifica la primera vez que se publica (publishedAt vacio).
    const isFirstPublish = updateNewsDto.isPublished === true && !news.publishedAt;

    if (updateNewsDto.title !== undefined) news.title = updateNewsDto.title;
    if (updateNewsDto.body !== undefined) news.body = updateNewsDto.body;
    if (updateNewsDto.imageUrl !== undefined) news.imageUrl = updateNewsDto.imageUrl || null;
    if (updateNewsDto.audienceRoles !== undefined || updateNewsDto.audienceUserIds !== undefined) {
      const audience = await this.resolveAudience(
        updateNewsDto.audienceRoles !== undefined ? updateNewsDto.audienceRoles : news.audienceRoles,
        updateNewsDto.audienceUserIds !== undefined
          ? updateNewsDto.audienceUserIds
          : (news.audienceUsers ?? []).map((u) => u.id),
      );
      news.audienceRoles = audience.audienceRoles;
      news.audienceUsers = audience.audienceUsers;
    }
    if (updateNewsDto.isPublished !== undefined) news.isPublished = updateNewsDto.isPublished;
    if (isFirstPublish) news.publishedAt = new Date();

    const saved = await this.newsRepository.save(news);

    if (isFirstPublish) {
      await this.notifyPublished(saved);
    }

    return saved;
  }

  async remove(id: string, currentUser: CurrentUser) {
    this.assertAdmin(currentUser);

    const news = await this.newsRepository.findOne({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }

    await this.newsReadsRepository.delete({ newsId: id });
    return this.newsRepository.remove(news);
  }

  // ---------------------------------------------------------------- App

  /** Noticias publicadas visibles para el usuario, con la marca de leida. */
  async findPublishedForUser(pageOptionsDto: PageOptionsDto, currentUser: CurrentUser): Promise<PageDto<NewsForUser>> {
    const query = this.publishedForUserQuery(currentUser)
      .orderBy('news.publishedAt', 'DESC')
      .addOrderBy('news.id', 'DESC')
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take);

    const [items, totalCount] = await query.getManyAndCount();
    const readsByNews = await this.readsByNewsId(currentUser.id, items.map((item) => item.id));

    return new PageDto(
      items.map((item) => this.toUserNews(item, readsByNews.get(item.id) ?? null)),
      new PageMetaDto({ totalCount, pageOptionsDto }),
    );
  }

  /** Noticias publicadas visibles que el usuario aun no acepto, de la mas antigua a la mas nueva. */
  async findUnreadForUser(currentUser: CurrentUser): Promise<NewsForUser[]> {
    const items = await this.publishedForUserQuery(currentUser)
      .leftJoin(
        NewsReadsEntity,
        'newsRead',
        'newsRead.newsId = news.id AND newsRead.userId = :userId',
        { userId: currentUser.id },
      )
      .andWhere('newsRead.id IS NULL')
      .orderBy('news.publishedAt', 'ASC')
      .addOrderBy('news.id', 'ASC')
      .getMany();

    return items.map((item) => this.toUserNews(item, null));
  }

  async accept(id: string, currentUser: CurrentUser) {
    const news = await this.newsRepository.findOne({ where: { id } });

    if (!news || !news.isPublished || !isNewsVisibleFor(news.audienceRoles, news.audienceUsers, currentUser)) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }

    const existing = await this.newsReadsRepository.findOne({
      where: { newsId: id, userId: currentUser.id },
    });

    if (existing) {
      return { newsId: id, acceptedAt: existing.acceptedAt };
    }

    try {
      const saved = await this.newsReadsRepository.save(
        this.newsReadsRepository.create({ newsId: id, userId: currentUser.id, acceptedAt: new Date() }),
      );
      return { newsId: id, acceptedAt: saved.acceptedAt };
    } catch (error: any) {
      // Doble tap / carrera: el indice unico ya tiene el registro.
      if (error?.code === 'ER_DUP_ENTRY') {
        const read = await this.newsReadsRepository.findOne({ where: { newsId: id, userId: currentUser.id } });
        return { newsId: id, acceptedAt: read?.acceptedAt ?? new Date() };
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------- Internals

  private publishedForUserQuery(currentUser: CurrentUser): SelectQueryBuilder<NewsEntity> {
    const query = this.newsRepository.createQueryBuilder('news')
      .where('news.isPublished = :isPublished', { isPublished: true });

    // simple-json guarda '["4","7"]' y '[{"id":"12","roleId":"4"}]' (orden de claves fijo).
    // Misma regla que isNewsVisibleFor, en SQL para que la paginación cuadre.
    query.andWhere(new Brackets((qb) => {
      qb.where('news.audienceRoles IS NULL AND news.audienceUsers IS NULL');
      qb.orWhere('news.audienceUsers LIKE :userLike', { userLike: `%"id":"${currentUser.id}"%` });
      if (currentUser.roleId) {
        qb.orWhere(new Brackets((r) => {
          r.where('news.audienceRoles LIKE :roleLike', { roleLike: `%"${currentUser.roleId}"%` })
            .andWhere(new Brackets((u) => {
              u.where('news.audienceUsers IS NULL')
                .orWhere('news.audienceUsers NOT LIKE :roleUsersLike', { roleUsersLike: `%"roleId":"${currentUser.roleId}"%` });
            }));
        }));
      }
    }));

    return query;
  }

  private async readsByNewsId(userId: string, newsIds: string[]) {
    const map = new Map<string, Date>();
    if (newsIds.length === 0) return map;

    const reads = await this.newsReadsRepository.createQueryBuilder('newsRead')
      .where('newsRead.userId = :userId', { userId })
      .andWhere('newsRead.newsId IN (:...newsIds)', { newsIds })
      .getMany();

    reads.forEach((read) => map.set(String(read.newsId), read.acceptedAt));
    return map;
  }

  private toUserNews(news: NewsEntity, acceptedAt: Date | null): NewsForUser {
    return {
      id: news.id,
      title: news.title,
      body: news.body,
      imageUrl: news.imageUrl,
      publishedAt: news.publishedAt,
      read: Boolean(acceptedAt),
      acceptedAt,
    };
  }

  /** Push (sin SMS) a todos los usuarios activos de la app con token Expo que esten en la audiencia. */
  async notifyPublished(news: NewsEntity) {
    try {
      const users = await this.usersRepository.createQueryBuilder('user')
        .select(['user.id', 'user.roleId', 'user.token'])
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere("user.token IS NOT NULL AND user.token <> ''")
        .getMany();

      const tokens = Array.from(new Set(
        users
          .filter((user) => isNewsVisibleFor(news.audienceRoles, news.audienceUsers, user))
          .map((user) => user.token)
          .filter((token) => Expo.isExpoPushToken(token)),
      ));

      if (tokens.length === 0) {
        return { sent: 0 };
      }

      await this.pushNotificationsService.sendNotification({
        title: news.title,
        body: truncate(news.body.replace(/\s+/g, ' ').trim(), PUSH_BODY_MAX_LENGTH),
        data: { type: 'news', newsId: news.id },
        tokensNotification: { tokens, users: [] },
        skipSms: true,
      });

      return { sent: tokens.length };
    } catch (error) {
      this.logger.error(`Error sending news push for news ${news.id}`, error as any);
      return { sent: 0 };
    }
  }
}
