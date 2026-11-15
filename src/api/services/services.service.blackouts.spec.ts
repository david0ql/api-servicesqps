import { BadRequestException } from '@nestjs/common';

// ServicesService importa modulos que leen variables de entorno al cargar.
jest.mock('../../push-notification/push-notification.service', () => ({ PushNotificationsService: class {} }));
jest.mock('./service-notifier.service', () => ({ ServiceNotifierService: class {} }));

import { ServicesService } from './services.service';

describe('ServicesService + dias fuera de servicio', () => {
  const servicesRepository: any = {
    create: jest.fn((x) => ({ ...x, id: '1' })),
    save: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
  };
  const extrasRepository: any = { find: jest.fn(), save: jest.fn(), remove: jest.fn(), create: jest.fn() };
  const usersRepository: any = { findOne: jest.fn() };
  const communitiesRepository: any = {};
  const notifier: any = { notificar: jest.fn() };
  const blackouts: any = {
    assertServiceAllowed: jest.fn(),
    assertServiceUpdateAllowed: jest.fn(),
  };
  const service = new ServicesService(
    servicesRepository, extrasRepository, usersRepository, communitiesRepository, {} as any, notifier, blackouts,
  );

  const dto: any = {
    date: '2026-11-26', schedule: '09:00:00', communityId: '5', typeId: '1', statusId: '1',
    unitNumber: '101', unitySize: '1BR',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('create: si el dia esta bloqueado responde 400 y no guarda nada', async () => {
    blackouts.assertServiceAllowed.mockRejectedValue(
      new BadRequestException('La comunidad Oak no trabaja el 2026-11-26 (Thanksgiving)'),
    );
    await expect(service.create(dto)).rejects.toThrow('La comunidad Oak no trabaja el 2026-11-26 (Thanksgiving)');
    expect(blackouts.assertServiceAllowed).toHaveBeenCalledWith(dto);
    expect(servicesRepository.save).not.toHaveBeenCalled();
    expect(notifier.notificar).not.toHaveBeenCalled();
  });

  it('create: si esta permitido guarda normalmente', async () => {
    blackouts.assertServiceAllowed.mockResolvedValue(undefined);
    servicesRepository.findOne.mockResolvedValue({ id: '1' });
    await service.create(dto);
    expect(servicesRepository.save).toHaveBeenCalled();
  });

  it('update: valida el movimiento antes de guardar', async () => {
    servicesRepository.findOne.mockResolvedValue({ id: '1', userId: null, statusId: '1' });
    blackouts.assertServiceUpdateAllowed.mockRejectedValue(new BadRequestException('bloqueado'));
    await expect(service.update('1', { date: '2026-11-26' })).rejects.toThrow('bloqueado');
    expect(blackouts.assertServiceUpdateAllowed).toHaveBeenCalledWith('1', { date: '2026-11-26' });
    expect(servicesRepository.preload).not.toHaveBeenCalled();
    expect(servicesRepository.save).not.toHaveBeenCalled();
  });
});
