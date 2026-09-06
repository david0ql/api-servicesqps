import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import moment from 'moment-timezone';

import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { PushNotificationsService } from '../../push-notification/push-notification.service';

/**
 * Unico lugar donde se decide QUIEN recibe aviso de cada evento de un servicio
 * y QUE texto le llega.
 *
 * Antes esto estaba repartido entre services.service (creacion, cambio de
 * estado, finalizacion con GPS, borrado) y reviews.service (refresh), cada uno
 * con su propia lista de destinatarios. El flujo confirmado por Felix el
 * 05/09/2026 exige reglas distintas por evento, asi que se centralizo aqui.
 *
 * Dos reglas transversales:
 *   - Solo se notifica a usuarios ACTIVOS. Antes no se filtraba y una QA dada
 *     de baja seguia recibiendo SMS.
 *   - La CLEANER recibe el numero de apartamento enmascarado, para obligarla a
 *     abrir la App, que es donde esta el dato vigente. El resto lo ve completo.
 */

export type EventoServicio =
  | 'creado'
  | 'asignado'
  | 'aceptado'
  | 'rechazado'
  | 'completado'
  | 'finalizado'
  | 'refresh'
  | 'eliminado';

const ROL_ADMIN = '1';
const ROL_CLEANER = '4';
const ROL_QA = '7';

/** Lo que ve la cleaner en lugar del numero de apartamento. */
export const UNIDAD_ENMASCARADA = '(ver en la App)';

/** Matriz confirmada por Felix el 05/09/2026. */
const DESTINATARIOS: Record<EventoServicio, {
  admin: boolean; cleaner: boolean; qa: boolean; supervisor: boolean;
}> = {
  creado:     { admin: true, cleaner: false, qa: false, supervisor: true },
  asignado:   { admin: true, cleaner: true,  qa: false, supervisor: false },
  aceptado:   { admin: true, cleaner: false, qa: false, supervisor: false },
  rechazado:  { admin: true, cleaner: false, qa: false, supervisor: false },
  completado: { admin: true, cleaner: true,  qa: true,  supervisor: true },
  finalizado: { admin: true, cleaner: false, qa: true,  supervisor: true },
  refresh:    { admin: true, cleaner: true,  qa: true,  supervisor: true },
  // El borrado no estaba en el flujo pedido; se deja como estaba: admin y la
  // cleaner que lo tenia asignado.
  eliminado:  { admin: true, cleaner: true,  qa: false, supervisor: false },
};

@Injectable()
export class ServiceNotifierService {
  private readonly logger = new Logger(ServiceNotifierService.name);

  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    @InjectRepository(CommunitiesEntity)
    private readonly communitiesRepository: Repository<CommunitiesEntity>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  async notificar(evento: EventoServicio, service: ServicesEntity) {
    const regla = DESTINATARIOS[evento];
    const destinatarios = await this.resolverDestinatarios(regla, service);

    if (!destinatarios.length) {
      this.logger.warn(`Evento "${evento}" del servicio ${service.id}: no hay destinatarios.`);
      return { done: true };
    }

    const conTelefono = destinatarios.filter((u) => u.phoneNumber?.trim());
    const conToken = destinatarios.filter((u) => u.token?.trim());

    this.logger.log(
      `Evento "${evento}" servicio ${service.id} -> ` +
      destinatarios.map((u) => `${u.name}(${u.roleId})`).join(', '),
    );

    return this.pushNotificationsService.sendNotification({
      body: this.armarTexto(evento, service, false),
      title: this.titulo(evento),
      sound: 'default',
      data: {
        serviceId: service.id,
        serviceType: service.type,
        serviceDate: service.date,
        serviceStatus: service.status,
        evento,
        // La app las usa para el boton "Como llegar" del servicio aceptado.
        communityLatitude: service.community?.latitude ?? null,
        communityLongitude: service.community?.longitude ?? null,
      },
      tokensNotification: {
        tokens: conToken.map((u) => u.token),
        users: conTelefono.map((u) =>
          Object.assign(Object.create(Object.getPrototypeOf(u)), u, {
            smsBody: this.armarTexto(evento, service, u.roleId === ROL_CLEANER),
          }),
        ),
      },
    });
  }

  private async resolverDestinatarios(
    regla: { admin: boolean; cleaner: boolean; qa: boolean; supervisor: boolean },
    service: ServicesEntity,
  ): Promise<UsersEntity[]> {
    const seleccion: UsersEntity[] = [];

    if (regla.admin) {
      seleccion.push(...await this.usersRepository.find({
        where: { roleId: ROL_ADMIN, isActive: true },
        select: ['id', 'name', 'token', 'phoneNumber', 'roleId'],
      }));
    }

    if (regla.qa) {
      seleccion.push(...await this.usersRepository.find({
        where: { roleId: ROL_QA, isActive: true },
        select: ['id', 'name', 'token', 'phoneNumber', 'roleId'],
      }));
    }

    if (regla.cleaner && service.userId) {
      const cleaner = await this.usersRepository.findOne({
        where: { id: service.userId, isActive: true },
        select: ['id', 'name', 'token', 'phoneNumber', 'roleId'],
      });
      if (cleaner) seleccion.push(cleaner);
    }

    if (regla.supervisor && service.communityId) {
      // Solo el SUPERVISOR de la comunidad. El MANAGER ya no recibe avisos
      // (confirmado por Felix). Si la comunidad no tiene supervisor cargado,
      // ese aviso simplemente no le llega a nadie mas que al admin.
      const comunidad = await this.communitiesRepository.findOne({
        where: { id: service.communityId },
        select: ['id', 'supervisorUserId'],
      });
      if (comunidad?.supervisorUserId) {
        const supervisor = await this.usersRepository.findOne({
          where: { id: comunidad.supervisorUserId, isActive: true },
          select: ['id', 'name', 'token', 'phoneNumber', 'roleId'],
        });
        if (supervisor) seleccion.push(supervisor);
      }
    }

    // Una misma persona puede caer por dos vias (ej. admin que ademas es
    // supervisor de la comunidad): se envia una sola vez.
    return seleccion.filter((u, i, todos) => todos.findIndex((o) => o.id === u.id) === i);
  }

  private armarTexto(evento: EventoServicio, service: ServicesEntity, paraCleaner: boolean): string {
    const comunidad = service.community?.communityName ?? 'Unknown Community';
    const fecha = moment.utc(service.date).format('MM/DD/YYYY');
    const cleaner = service.user?.name ?? 'Unknown';
    const unidad = paraCleaner
      ? UNIDAD_ENMASCARADA
      : (service.unitNumber?.trim() || 'Unknown Apartment');

    switch (evento) {
      case 'creado':
        return `New service created for ${comunidad} on ${fecha} in apartment number ${unidad}`;
      case 'asignado':
        return `You have a new service for ${fecha} in ${comunidad} in apartment number ${unidad}`;
      case 'aceptado':
        return `Approved by ${cleaner} in ${comunidad} for ${fecha} in apartment number ${unidad}`;
      case 'rechazado':
        return `The cleaner ${cleaner} has rejected the service in ${comunidad} on ${fecha}`;
      case 'completado':
        return `Completed by ${cleaner} in ${comunidad} on ${fecha} in apartment number ${unidad}`;
      case 'finalizado':
        return `QA finished the inspection in ${comunidad} on ${fecha} in apartment number ${unidad}`;
      case 'refresh':
        return `Refresh needed in ${comunidad} on ${fecha} in apartment number ${unidad}`;
      case 'eliminado':
        return `The service has been deleted for apartment ${unidad} in ${comunidad}`;
    }
  }

  private titulo(evento: EventoServicio): string {
    if (evento === 'refresh') return 'Service Needs Refresh';
    if (evento === 'creado') return 'New Service Created';
    if (evento === 'eliminado') return 'Service Deleted';
    return 'Service Status Updated';
  }
}
