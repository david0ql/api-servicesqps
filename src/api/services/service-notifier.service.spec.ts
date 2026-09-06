import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ServiceNotifierService, UNIDAD_ENMASCARADA } from './service-notifier.service';
import { UsersEntity } from '../../entities/users.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { PushNotificationsService } from '../../push-notification/push-notification.service';

const usuario = (id: string, name: string, roleId: string) =>
  ({ id, name, roleId, phoneNumber: `+1${id.padStart(10, '0')}`, token: `tok-${id}` } as UsersEntity);

const ADMIN = usuario('1', 'Felix', '1');
const CLEANER = usuario('9', 'Karla', '4');
const QA = usuario('82', 'Betsy', '7');
const SUPERVISOR = usuario('60', 'Julio', '6');
const MANAGER = usuario('30', 'Shalonda', '3');

describe('ServiceNotifierService', () => {
  let notifier: ServiceNotifierService;
  let enviados: any;

  const servicio = {
    id: '100',
    userId: CLEANER.id,
    communityId: '41',
    unitNumber: '2-401',
    date: '2026-09-10',
    community: { communityName: 'Kestra Apartments', latitude: '28.41', longitude: '-81.53' },
    user: { name: 'Karla' },
    status: { id: '3', statusName: 'Approved' },
  } as unknown as ServicesEntity;

  beforeEach(async () => {
    enviados = null;

    const usersRepo = {
      // Solo devuelve activos: el servicio siempre consulta con isActive: true
      find: jest.fn(({ where }) => {
        if (!where.isActive) return Promise.resolve([]);
        if (where.roleId === '1') return Promise.resolve([ADMIN]);
        if (where.roleId === '7') return Promise.resolve([QA]);
        return Promise.resolve([]);
      }),
      findOne: jest.fn(({ where }) => {
        if (!where.isActive) return Promise.resolve(null);
        const todos = [ADMIN, CLEANER, QA, SUPERVISOR, MANAGER];
        return Promise.resolve(todos.find((u) => u.id === where.id) ?? null);
      }),
    };

    const communitiesRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({ id: '41', supervisorUserId: SUPERVISOR.id } as CommunitiesEntity),
      ),
    };

    const push = { sendNotification: jest.fn((n) => { enviados = n; return Promise.resolve({ done: true }); }) };

    const modulo = await Test.createTestingModule({
      providers: [
        ServiceNotifierService,
        { provide: getRepositoryToken(UsersEntity), useValue: usersRepo },
        { provide: getRepositoryToken(CommunitiesEntity), useValue: communitiesRepo },
        { provide: PushNotificationsService, useValue: push },
      ],
    }).compile();

    notifier = modulo.get(ServiceNotifierService);
  });

  const destinatarios = () => enviados.tokensNotification.users.map((u: any) => u.name).sort();

  describe('matriz de destinatarios confirmada por Felix', () => {
    it('creado -> admin y supervisor', async () => {
      await notifier.notificar('creado', servicio);
      expect(destinatarios()).toEqual(['Felix', 'Julio']);
    });

    it('asignado -> admin y cleaner', async () => {
      await notifier.notificar('asignado', servicio);
      expect(destinatarios()).toEqual(['Felix', 'Karla']);
    });

    it('aceptado -> solo admin', async () => {
      await notifier.notificar('aceptado', servicio);
      expect(destinatarios()).toEqual(['Felix']);
    });

    it('rechazado -> solo admin', async () => {
      await notifier.notificar('rechazado', servicio);
      expect(destinatarios()).toEqual(['Felix']);
    });

    it('completado -> admin, cleaner, QA y supervisor', async () => {
      await notifier.notificar('completado', servicio);
      expect(destinatarios()).toEqual(['Betsy', 'Felix', 'Julio', 'Karla']);
    });

    it('finalizado -> admin, QA y supervisor (sin la cleaner)', async () => {
      await notifier.notificar('finalizado', servicio);
      expect(destinatarios()).toEqual(['Betsy', 'Felix', 'Julio']);
    });

    it('refresh -> admin, cleaner, QA y supervisor', async () => {
      await notifier.notificar('refresh', servicio);
      expect(destinatarios()).toEqual(['Betsy', 'Felix', 'Julio', 'Karla']);
    });

    it('el MANAGER de la comunidad no recibe en ningun evento', async () => {
      for (const evento of ['creado', 'asignado', 'aceptado', 'rechazado', 'completado', 'finalizado', 'refresh'] as const) {
        await notifier.notificar(evento, servicio);
        expect(destinatarios()).not.toContain('Shalonda');
      }
    });
  });

  describe('enmascarado del numero de apartamento', () => {
    it('la cleaner NO ve el numero de apartamento', async () => {
      await notifier.notificar('completado', servicio);
      const karla = enviados.tokensNotification.users.find((u: any) => u.name === 'Karla');
      expect(karla.smsBody).toContain(UNIDAD_ENMASCARADA);
      expect(karla.smsBody).not.toContain('2-401');
    });

    it('admin, QA y supervisor SI lo ven', async () => {
      await notifier.notificar('completado', servicio);
      for (const nombre of ['Felix', 'Betsy', 'Julio']) {
        const u = enviados.tokensNotification.users.find((x: any) => x.name === nombre);
        expect(u.smsBody).toContain('2-401');
        expect(u.smsBody).not.toContain(UNIDAD_ENMASCARADA);
      }
    });
  });

  it('el SMS ya no lleva link de mapa', async () => {
    await notifier.notificar('aceptado', servicio);
    expect(enviados.body).not.toContain('maps.google.com');
    expect(enviados.body).not.toContain('Map:');
  });

  it('las coordenadas viajan en la notificacion para el boton de la app', async () => {
    await notifier.notificar('aceptado', servicio);
    expect(enviados.data.communityLatitude).toBe('28.41');
    expect(enviados.data.communityLongitude).toBe('-81.53');
  });

  it('una comunidad sin supervisor no rompe el envio', async () => {
    const sinSupervisor = await Test.createTestingModule({
      providers: [
        ServiceNotifierService,
        { provide: getRepositoryToken(UsersEntity), useValue: {
          find: jest.fn(({ where }) => Promise.resolve(where.roleId === '1' && where.isActive ? [ADMIN] : [])),
          findOne: jest.fn(() => Promise.resolve(null)),
        } },
        { provide: getRepositoryToken(CommunitiesEntity), useValue: {
          findOne: jest.fn(() => Promise.resolve({ id: '41', supervisorUserId: null })),
        } },
        { provide: PushNotificationsService, useValue: { sendNotification: jest.fn((n) => { enviados = n; return Promise.resolve({}); }) } },
      ],
    }).compile();

    await sinSupervisor.get(ServiceNotifierService).notificar('creado', servicio);
    expect(destinatarios()).toEqual(['Felix']);
  });
});
