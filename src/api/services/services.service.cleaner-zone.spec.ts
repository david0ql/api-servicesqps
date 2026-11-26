import { BadRequestException } from '@nestjs/common';

jest.mock('../../push-notification/push-notification.service', () => ({ PushNotificationsService: class {} }));
jest.mock('./service-notifier.service', () => ({ ServiceNotifierService: class {} }));

import { ServicesService } from './services.service';

describe('ServicesService + zona de trabajo de la cleaner', () => {
  const servicesRepository: any = {
    create: jest.fn((x) => ({ ...x, id: '1' })),
    save: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(async (x) => x),
  };
  const usersRepository: any = { findOne: jest.fn(async () => ({ id: '44', roleId: '4' })) };
  const notifier: any = { notificar: jest.fn() };
  const blackouts: any = { assertServiceAllowed: jest.fn(), assertServiceUpdateAllowed: jest.fn() };
  const cleanerZones: any = { assertEligible: jest.fn() };
  const service = new ServicesService(
    servicesRepository, { find: jest.fn(), save: jest.fn() } as any, usersRepository, {} as any, {} as any,
    notifier, blackouts, cleanerZones,
  );
  const dto: any = { date: '2026-12-20', schedule: '09:00:00', communityId: '5', typeId: '1', statusId: '2', userId: '44' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('create: valida la zona con la comunidad del servicio y no guarda si falla', async () => {
    cleanerZones.assertEligible.mockRejectedValueOnce(new BadRequestException('fuera de zona'));
    await expect(service.create({ ...dto })).rejects.toThrow('fuera de zona');
    expect(cleanerZones.assertEligible).toHaveBeenCalledWith('44', '5');
    expect(servicesRepository.save).not.toHaveBeenCalled();
  });

  it('update: solo valida si cambia el cleaner o la comunidad', async () => {
    servicesRepository.findOne.mockResolvedValue({ id: '1', userId: '44', communityId: '5', statusId: '2', date: '2026-12-20', assignedAt: new Date() });
    await service.update('1', { userId: '44', comment: 'x' } as any);
    expect(cleanerZones.assertEligible).not.toHaveBeenCalled();

    await service.update('1', { userId: '44', communityId: '6' } as any);
    expect(cleanerZones.assertEligible).toHaveBeenCalledWith('44', '6');

    await service.update('1', { userId: '45' } as any);
    expect(cleanerZones.assertEligible).toHaveBeenLastCalledWith('45', '5');
  });
});
