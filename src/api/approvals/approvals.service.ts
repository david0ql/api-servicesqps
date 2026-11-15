import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Expo } from 'expo-server-sdk';

import envVars from '../../config/env';
import { ROLE_SUPER_ADMIN, isAdminPapel } from '../../constants/roles';
import {
  PendingChangeDecisionChannel,
  PendingChangeStatus,
  PendingChangesEntity,
} from '../../entities/pending_changes.entity';
import { UsersEntity } from '../../entities/users.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { RecurringServicesEntity } from '../../entities/recurring_services.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { CompaniesEntity } from '../../entities/companies.entity';
import { CostsEntity } from '../../entities/costs.entity';
import { RecurringCostsEntity } from '../../entities/recurring_costs.entity';
import { ExtrasEntity } from '../../entities/extras.entity';
import { TypesEntity } from '../../entities/types.entity';
import { StatusesEntity } from '../../entities/statuses.entity';
import { TextBeeService } from '../../textbee/textbee.service';
import { PushNotificationsService } from '../../push-notification/push-notification.service';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';

import { buildApprovalSummary, parseResourcePath } from './approval-summary.util';
import { generateUniqueApprovalCode } from './approval-code.util';
import { ApprovalDecision, parseApprovalReply } from './sms-reply.parser';
import { samePhone } from './phone.util';
import { ApprovalExecutorService } from './approval-executor.service';
import {
  DecisionResult,
  ShortRequest,
  msgAlreadyDecided,
  msgAmbiguous,
  msgCodeNotFound,
  msgConfirmationForDecider,
  msgExpired,
  msgNewRequest,
  msgNoPending,
  msgNotUnderstood,
  msgResultForOtherAdmins,
  msgResultForRequester,
} from './approval-messages';
import { ApprovalsQueryDto } from './dto/approvals-query.dto';
import { hasSensitiveKeys, redactSensitive } from './redact.util';

export interface QueueRequestInput {
  method: string;
  url: string;
  body: unknown;
  user: UsersEntity;
}

export interface DecisionOutcome {
  applied: boolean;
  change: PendingChangesEntity;
  /** Si no se aplicó: la solicitud ya estaba decidida por otro. */
  alreadyDecidedBy?: string | null;
}

const MAX_RESULT_BODY = 20_000;

/** Entidad a consultar para describir el recurso afectado en el resumen. */
const RESOURCE_ENTITIES: Record<string, { entity: Function; relations?: string[] }> = {
  services: { entity: ServicesEntity, relations: ['community'] },
  'recurring-services': { entity: RecurringServicesEntity, relations: ['community'] },
  communities: { entity: CommunitiesEntity },
  users: { entity: UsersEntity },
  companies: { entity: CompaniesEntity },
  costs: { entity: CostsEntity },
  'recurring-costs': { entity: RecurringCostsEntity },
  extras: { entity: ExtrasEntity },
  types: { entity: TypesEntity },
  statuses: { entity: StatusesEntity },
};

export const hashApprovalToken = (token: string) => createHash('sha256').update(token).digest('hex');

const errorMessageFrom = (status: number, body: any): string => {
  const raw = body?.message ?? body?.error ?? body;
  const text = Array.isArray(raw) ? raw.join('; ') : typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  return `${status ? `HTTP ${status}: ` : ''}${text}`.slice(0, 500);
};

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    @InjectRepository(PendingChangesEntity)
    private readonly pendingRepository: Repository<PendingChangesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly dataSource: DataSource,
    private readonly textBeeService: TextBeeService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly executor: ApprovalExecutorService,
  ) { }

  // ---------------------------------------------------------------------------
  // Creación (desde el interceptor)
  // ---------------------------------------------------------------------------

  async queueRequest(input: QueueRequestInput): Promise<PendingChangesEntity> {
    const [path, queryString] = input.url.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryString ?? ''));
    const body = (input.body && typeof input.body === 'object' ? input.body : null) as Record<string, any> | null;
    const target = await this.loadSummaryTarget(input.method, path, body, query);
    const summary = buildApprovalSummary({ method: input.method, path, query, body, target });

    const pendingCodes = await this.pendingRepository.find({ where: { status: 'pending' }, select: ['code'] });
    const code = generateUniqueApprovalCode(new Set(pendingCodes.map((p) => p.code)));

    const change = await this.pendingRepository.save(this.pendingRepository.create({
      code,
      method: input.method.toUpperCase(),
      url: input.url,
      body: input.body ?? null,
      userId: input.user.id,
      summary,
      status: 'pending',
    }));

    this.logger.log(`Solicitud ${code} creada por ${input.user.id}: ${summary}`);

    const admins = await this.activeAdmins();
    await this.sendSmsMany(admins, msgNewRequest(input.user.name, change));

    return change;
  }

  /** Busca el registro afectado (o la comunidad al crear) para el resumen. */
  private async loadSummaryTarget(
    method: string,
    path: string,
    body: Record<string, any> | null,
    query: Record<string, string>,
  ): Promise<Record<string, any> | null> {
    try {
      const { resource, id, segments } = parseResourcePath(path);

      if (resource === 'services' && segments[1] === 'community' && segments[2]) {
        return await this.dataSource.getRepository(CommunitiesEntity).findOne({ where: { id: segments[2] } });
      }

      const config = RESOURCE_ENTITIES[resource];
      if (!config) return null;

      if (id) {
        return await this.dataSource.getRepository(config.entity).findOne({
          where: { id } as any,
          relations: config.relations,
        }) as Record<string, any> | null;
      }

      if (method.toUpperCase() === 'POST' && body?.communityId && config.relations?.includes('community')) {
        const community = await this.dataSource.getRepository(CommunitiesEntity).findOne({
          where: { id: String(body.communityId) },
          select: ['id', 'communityName'],
        });
        return community ? { communityName: community.communityName } : null;
      }
    } catch (error) {
      this.logger.warn(`No se pudo describir ${method} ${path}: ${error.message}`);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Re-ejecución (el interceptor valida el token)
  // ---------------------------------------------------------------------------

  /**
   * Valida y CONSUME el token de re-ejecución. Solo pasa si: el token coincide
   * con una solicitud aprobada, del mismo usuario, mismo método y url, y nunca
   * se usó. La marca de consumo es atómica (UPDATE ... WHERE consumed IS NULL).
   */
  async consumeReplayToken(token: string, method: string, url: string, userId: string): Promise<boolean> {
    if (!token) return false;
    const change = await this.pendingRepository
      .createQueryBuilder('pc')
      .where('pc.approval_token_hash = :hash', { hash: hashApprovalToken(token) })
      .getOne();

    if (!change) return false;
    if (change.status !== 'approved' || change.tokenConsumedAt) return false;
    if (String(change.userId) !== String(userId)) return false;
    if (change.method.toUpperCase() !== method.toUpperCase() || change.url !== url) return false;

    const result = await this.pendingRepository
      .createQueryBuilder()
      .update(PendingChangesEntity)
      .set({ tokenConsumedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: change.id })
      .andWhere('token_consumed_at IS NULL')
      .andWhere('status = :status', { status: 'approved' })
      .execute();

    return (result.affected ?? 0) === 1;
  }

  // ---------------------------------------------------------------------------
  // Decisión
  // ---------------------------------------------------------------------------

  /**
   * Aplica la decisión de un admin. La primera decisión gana: el UPDATE solo
   * afecta filas con status = 'pending'. Si se aprueba, re-ejecuta la petición
   * y deja executed/failed. Notifica al solicitante y a los demás admins.
   */
  async decide(
    changeId: string,
    admin: UsersEntity,
    decision: ApprovalDecision,
    comment: string | null,
    channel: PendingChangeDecisionChannel,
  ): Promise<DecisionOutcome> {
    const token = decision === 'approve' ? randomBytes(32).toString('hex') : null;

    const result = await this.pendingRepository
      .createQueryBuilder()
      .update(PendingChangesEntity)
      .set({
        status: decision === 'approve' ? 'approved' : 'rejected',
        decidedByUserId: admin.id,
        decisionChannel: channel,
        comment: comment?.trim() ? comment.trim().slice(0, 1000) : null,
        decidedAt: () => 'CURRENT_TIMESTAMP',
        approvalTokenHash: token ? hashApprovalToken(token) : null,
      })
      .where('id = :id', { id: changeId })
      .andWhere('status = :pending', { pending: 'pending' })
      .execute();

    const change = await this.findWithUsers(changeId);
    if (!change) throw new NotFoundException(`Solicitud ${changeId} no encontrada`);

    if ((result.affected ?? 0) !== 1) {
      return { applied: false, change, alreadyDecidedBy: change.decidedByUser?.name ?? null };
    }

    if (decision === 'approve' && token) {
      await this.execute(change, token);
    }

    await this.scrubBody(change);
    const finalChange = (await this.findWithUsers(changeId)) ?? change;
    await this.notifyDecision(finalChange, admin, channel);
    return { applied: true, change: finalChange };
  }

  private async execute(change: PendingChangesEntity, token: string) {
    const requester = change.user ?? await this.usersRepository.findOne({ where: { id: change.userId } });
    if (!requester || !requester.isActive) {
      await this.pendingRepository.update(change.id, {
        status: 'failed',
        error: 'El usuario solicitante ya no está activo.',
        executedAt: new Date(),
      });
      return;
    }

    const replay = await this.executor.replay({
      method: change.method,
      url: change.url,
      body: change.body,
      user: { id: requester.id, email: requester.email },
      approvalToken: token,
    });

    const ok = replay.status >= 200 && replay.status < 300;
    let resultBody: string | null = null;
    try {
      resultBody = replay.body === undefined ? null : JSON.stringify(redactSensitive(replay.body));
      if (resultBody && resultBody.length > MAX_RESULT_BODY) resultBody = `${resultBody.slice(0, MAX_RESULT_BODY)}...`;
    } catch {
      resultBody = null;
    }

    await this.pendingRepository.update(change.id, {
      status: ok ? 'executed' : 'failed',
      resultStatus: replay.status || null,
      resultBody,
      error: ok ? null : errorMessageFrom(replay.status, replay.body),
      executedAt: new Date(),
    });
    this.logger.log(`Solicitud ${change.code} ${ok ? 'ejecutada' : 'falló'} (HTTP ${replay.status}).`);
  }

  /** Una vez cerrada la solicitud ya no se re-ejecuta: no guardar contraseñas en claro. */
  private async scrubBody(change: PendingChangesEntity) {
    if (hasSensitiveKeys(change.body)) {
      await this.pendingRepository.update(change.id, { body: redactSensitive(change.body) as any });
    }
  }

  private async findWithUsers(id: string) {
    return this.pendingRepository.findOne({ where: { id }, relations: ['user', 'decidedByUser'] });
  }

  // ---------------------------------------------------------------------------
  // Web
  // ---------------------------------------------------------------------------

  async list(currentUser: UsersEntity, query: ApprovalsQueryDto): Promise<PageDto<PendingChangesEntity>> {
    const isSuperAdmin = String(currentUser.roleId) === ROLE_SUPER_ADMIN;
    if (!isSuperAdmin && !isAdminPapel(currentUser.roleId)) {
      throw new ForbiddenException('Solo administradores pueden ver solicitudes de aprobación.');
    }

    const take = query.take ?? 20;
    const page = query.page ?? 1;
    const qb = this.pendingRepository
      .createQueryBuilder('pc')
      .leftJoin('pc.user', 'user')
      .addSelect(['user.id', 'user.name'])
      .leftJoin('pc.decidedByUser', 'decidedByUser')
      .addSelect(['decidedByUser.id', 'decidedByUser.name'])
      .orderBy('pc.createdAt', 'DESC')
      .skip((page - 1) * take)
      .take(take);

    if (!isSuperAdmin) qb.andWhere('pc.userId = :userId', { userId: currentUser.id });
    if (query.status) qb.andWhere('pc.status = :status', { status: query.status });

    const [rawItems, itemCount] = await qb.getManyAndCount();
    const items = rawItems.map((item) => ({ ...item, body: redactSensitive(item.body) }) as PendingChangesEntity);
    const pageMetaDto = new PageMetaDto({ totalCount: itemCount, pageOptionsDto: { page, take } as any });
    return new PageDto(items, pageMetaDto);
  }

  async decideFromWeb(id: string, admin: UsersEntity, decision: ApprovalDecision, comment?: string | null) {
    if (String(admin.roleId) !== ROLE_SUPER_ADMIN) {
      throw new ForbiddenException('Solo los super admins pueden aprobar o rechazar solicitudes.');
    }
    const exists = await this.pendingRepository.findOne({ where: { id }, select: ['id'] });
    if (!exists) throw new NotFoundException(`Solicitud ${id} no encontrada`);

    const outcome = await this.decide(id, admin, decision, comment ?? null, 'web');
    if (!outcome.applied) {
      throw new ConflictException(
        msgAlreadyDecided(outcome.change.code, outcome.change.status, outcome.alreadyDecidedBy).replace(/^QPS: /, ''),
      );
    }
    return outcome.change;
  }

  // ---------------------------------------------------------------------------
  // SMS entrante (webhook de TextBee)
  // ---------------------------------------------------------------------------

  /** Procesa un SMS entrante. Devuelve una descripción corta de lo que hizo. */
  async handleInboundSms(sender: string, message: string): Promise<string> {
    const admins = await this.activeAdmins(true);
    const admin = admins.find((a) => samePhone(a.phoneNumber, sender));
    if (!admin) {
      this.logger.warn(`SMS entrante de ${sender} ignorado: no es un admin activo.`);
      return 'ignored:not-admin';
    }

    const pending = await this.pendingRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      select: ['id', 'code', 'summary'],
    });
    const shortPending: ShortRequest[] = pending.map((p) => ({ code: p.code, summary: p.summary }));

    const parsed = parseApprovalReply(message);
    if (!parsed) {
      await this.sendSms(admin, msgNotUnderstood(shortPending));
      return 'replied:not-understood';
    }

    let targetId: string | null = null;
    if (parsed.code) {
      const match = pending.find((p) => p.code === parsed.code);
      if (match) {
        targetId = match.id;
      } else {
        const last = await this.pendingRepository.findOne({
          where: { code: parsed.code },
          order: { createdAt: 'DESC' },
          relations: ['decidedByUser'],
        });
        if (last) {
          await this.sendSms(admin, msgAlreadyDecided(last.code, last.status, last.decidedByUser?.name));
          return 'replied:already-decided';
        }
        await this.sendSms(admin, msgCodeNotFound(parsed.code, shortPending));
        return 'replied:code-not-found';
      }
    } else if (pending.length === 1) {
      targetId = pending[0].id;
    } else if (pending.length === 0) {
      await this.sendSms(admin, msgNoPending());
      return 'replied:no-pending';
    } else {
      await this.sendSms(admin, msgAmbiguous(shortPending));
      return 'replied:ambiguous';
    }

    const outcome = await this.decide(targetId, admin, parsed.decision, parsed.comment, 'sms');
    if (!outcome.applied) {
      await this.sendSms(admin, msgAlreadyDecided(outcome.change.code, outcome.change.status, outcome.alreadyDecidedBy));
      return 'replied:already-decided';
    }
    return `decided:${outcome.change.status}`;
  }

  // ---------------------------------------------------------------------------
  // Expiración
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expirePending() {
    const hours = envVars.APPROVAL_EXPIRATION_HOURS ?? 48;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    const stale = await this.pendingRepository.find({
      where: { status: 'pending', createdAt: LessThan(cutoff) },
      relations: ['user'],
    });

    for (const change of stale) {
      const result = await this.pendingRepository
        .createQueryBuilder()
        .update(PendingChangesEntity)
        .set({ status: 'expired' })
        .where('id = :id', { id: change.id })
        .andWhere('status = :pending', { pending: 'pending' })
        .execute();
      if ((result.affected ?? 0) !== 1) continue;
      await this.scrubBody(change);
      if (change.user) await this.sendSms(change.user, msgExpired(change, hours));
    }
    if (stale.length) this.logger.log(`${stale.length} solicitudes de aprobación expiradas.`);
    return stale.length;
  }

  // ---------------------------------------------------------------------------
  // Notificaciones
  // ---------------------------------------------------------------------------

  private async notifyDecision(change: PendingChangesEntity, decider: UsersEntity, channel: PendingChangeDecisionChannel) {
    const result: DecisionResult = {
      code: change.code,
      summary: change.summary,
      status: change.status as PendingChangeStatus,
      deciderName: decider.name,
      comment: change.comment,
      error: change.error,
    };

    const requester = change.user;
    if (requester) {
      const text = msgResultForRequester(result);
      await this.sendSms(requester, text);
      await this.sendPush(requester, `Solicitud ${change.code}`, text, { pendingChangeId: change.id, status: change.status });
    }

    const admins = await this.activeAdmins();
    await this.sendSmsMany(admins.filter((a) => a.id !== decider.id), msgResultForOtherAdmins(result));

    if (channel === 'sms') {
      await this.sendSms(decider, msgConfirmationForDecider(result));
    }
  }

  /** Super admins (rol 1) activos. Con `includeWithoutPhone=false` solo los que tienen teléfono. */
  private async activeAdmins(includeWithoutPhone = false): Promise<UsersEntity[]> {
    const admins = await this.usersRepository.find({
      where: { roleId: ROLE_SUPER_ADMIN, isActive: true },
      select: ['id', 'name', 'phoneNumber', 'token', 'roleId', 'email'],
    });
    return includeWithoutPhone ? admins : admins.filter((a) => a.phoneNumber?.trim());
  }

  private async sendSmsMany(users: UsersEntity[], text: string) {
    await Promise.all(users.map((u) => this.sendSms(u, text)));
  }

  private async sendSms(user: Pick<UsersEntity, 'id' | 'phoneNumber'>, text: string): Promise<boolean> {
    if (!user?.phoneNumber?.trim()) return false;
    if (!envVars.APPROVAL_SMS_ENABLED) {
      this.logger.log(`[SMS deshabilitado] a ${user.id}: ${text}`);
      return false;
    }
    try {
      return await this.textBeeService.sendSMS(user.phoneNumber.trim(), text);
    } catch (error) {
      this.logger.error(`SMS a ${user.id} falló: ${error.message}`);
      return false;
    }
  }

  private async sendPush(user: UsersEntity, title: string, body: string, data: Record<string, any>) {
    const token = user.token?.trim();
    if (!token || !Expo.isExpoPushToken(token)) return;
    try {
      // users: [] para no duplicar el SMS (sendNotification también manda SMS).
      await this.pushNotificationsService.sendNotification({
        title,
        body,
        data,
        sound: 'default',
        tokensNotification: { tokens: [token], users: [] },
      });
    } catch (error) {
      this.logger.warn(`Push a ${user.id} falló: ${error.message}`);
    }
  }
}
