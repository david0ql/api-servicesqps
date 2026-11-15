jest.mock('../../config/env', () => ({ __esModule: true, default: {} }));
// page-meta.dto importa con ruta absoluta 'src/...' que ts-jest no resuelve.
jest.mock('../../dto/page-meta.dto', () => ({ PageMetaDto: class {} }));

import moment from 'moment-timezone';
import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServiceStatusId } from '../../constants/service-status.enum';

describe('ServicesService checkpoints after refresh', () => {
  const cleaner = { id: '9', roleId: '4' } as any;
  const location = { latitude: 28.41, longitude: -81.53 } as any;
  const today = moment().format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');

  const createService = (row: Record<string, any>) => {
    const queryBuilder: any = {
      leftJoinAndSelect: jest.fn(() => queryBuilder),
      where: jest.fn(() => queryBuilder),
      getOne: jest.fn(async () => ({ id: '100', ...row })),
    };
    const servicesRepository: any = {
      findOne: jest.fn(async () => ({ id: '100', userId: cleaner.id, ...row })),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    const notifier: any = { notificar: jest.fn() };

    const service = new ServicesService(
      servicesRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      notifier,
      { assertServiceAllowed: jest.fn(), assertServiceUpdateAllowed: jest.fn() } as any,
    );

    return { service, servicesRepository, notifier };
  };

  describe('trackServiceStart', () => {
    it('lets the cleaner start a refreshed service after its scheduled date', async () => {
      const { service, servicesRepository } = createService({
        statusId: ServiceStatusId.Approved,
        date: yesterday,
        startedAt: null,
        finishedAt: null,
        refreshCount: 1,
      });

      await service.trackServiceStart('100', location, cleaner);

      expect(servicesRepository.update).toHaveBeenCalledWith(
        '100',
        expect.objectContaining({ startedAt: expect.any(Date) }),
      );
    });

    it('still blocks a normal service outside its scheduled date', async () => {
      const { service } = createService({
        statusId: ServiceStatusId.Approved,
        date: yesterday,
        startedAt: null,
        finishedAt: null,
        refreshCount: 0,
      });

      await expect(service.trackServiceStart('100', location, cleaner)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks a refreshed service before its scheduled date', async () => {
      const { service } = createService({
        statusId: ServiceStatusId.Approved,
        date: tomorrow,
        startedAt: null,
        finishedAt: null,
        refreshCount: 1,
      });

      await expect(service.trackServiceStart('100', location, cleaner)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('starts a normal service on its scheduled date', async () => {
      const { service, servicesRepository } = createService({
        statusId: ServiceStatusId.Approved,
        date: today,
        startedAt: null,
        finishedAt: null,
        refreshCount: 0,
      });

      await service.trackServiceStart('100', location, cleaner);
      expect(servicesRepository.update).toHaveBeenCalled();
    });
  });

  describe('trackServiceFinish', () => {
    it('finishes a restarted refresh back to Completed and notifies completado', async () => {
      const { service, servicesRepository, notifier } = createService({
        statusId: ServiceStatusId.Approved,
        date: yesterday,
        startedAt: new Date(),
        finishedAt: null,
        refreshCount: 1,
      });

      await service.trackServiceFinish('100', location, cleaner);

      expect(servicesRepository.update).toHaveBeenCalledWith(
        '100',
        expect.objectContaining({ finishedAt: expect.any(Date), statusId: ServiceStatusId.Completed }),
      );
      expect(notifier.notificar).toHaveBeenCalledWith('completado', expect.anything());
    });
  });
});
