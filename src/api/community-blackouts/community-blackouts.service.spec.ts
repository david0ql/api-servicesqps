import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CommunityBlackoutsService, MAX_BLACKOUT_DAYS } from './community-blackouts.service';

describe('CommunityBlackoutsService', () => {
  const blackoutsRepository: any = {
    create: jest.fn((x) => ({ ...x })),
    save: jest.fn(async (rows) => rows.map((r, i) => Object.assign(r, { id: String(i + 1) }))),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const communitiesRepository: any = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const servicesRepository: any = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const service = new CommunityBlackoutsService(blackoutsRepository, communitiesRepository, servicesRepository);

  const oak = { id: '5', communityName: 'Oak Park' };
  const pine = { id: '8', communityName: 'Pine Hills' };

  beforeEach(() => {
    jest.clearAllMocks();
    communitiesRepository.find.mockResolvedValue([oak]);
    communitiesRepository.findOne.mockResolvedValue(oak);
    servicesRepository.find.mockResolvedValue([]);
    blackoutsRepository.find.mockResolvedValue([]);
  });

  describe('create', () => {
    const base = { communityId: '5', startDate: '2026-11-26', period: 'full_day' as const, reason: ' Thanksgiving ' };

    it('crea un dia completo (endDate = startDate) y limpia el motivo', async () => {
      const result = await service.create(base, { id: '1' } as any);
      expect(blackoutsRepository.create).toHaveBeenCalledWith({
        communityId: '5',
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        period: 'full_day',
        startTime: null,
        endTime: null,
        reason: 'Thanksgiving',
        createdByUserId: '1',
      });
      expect(result.blackouts).toHaveLength(1);
      expect(result.conflictingServices).toEqual([]);
    });

    it('acepta fechas ISO con hora', async () => {
      await service.create({ ...base, startDate: '2026-12-24T05:00:00.000Z', endDate: '2026-12-26T05:00:00.000Z' });
      expect(blackoutsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        startDate: '2026-12-24', endDate: '2026-12-26',
      }));
    });

    it('rechaza rango invertido', async () => {
      await expect(service.create({ ...base, endDate: '2026-11-25' })).rejects.toThrow(BadRequestException);
    });

    it(`rechaza rangos de mas de ${MAX_BLACKOUT_DAYS} dias`, async () => {
      await expect(service.create({ ...base, startDate: '2026-01-01', endDate: '2027-01-02' }))
        .rejects.toThrow(/366/);
      await expect(service.create({ ...base, startDate: '2026-01-01', endDate: '2027-01-01' }))
        .resolves.toBeDefined();
    });

    it('am/pm no guardan horas', async () => {
      await service.create({ ...base, period: 'am', startTime: '08:00', endTime: '09:00' });
      expect(blackoutsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        period: 'am', startTime: null, endTime: null,
      }));
    });

    it('custom normaliza HH:mm a HH:mm:ss', async () => {
      await service.create({ ...base, period: 'custom', startTime: '08:00', endTime: '24:00' });
      expect(blackoutsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        period: 'custom', startTime: '08:00:00', endTime: '24:00:00',
      }));
    });

    it('custom exige horas y fin > inicio', async () => {
      await expect(service.create({ ...base, period: 'custom' })).rejects.toThrow(/hora de inicio y fin/);
      await expect(service.create({ ...base, period: 'custom', startTime: '14:00', endTime: '08:00' }))
        .rejects.toThrow(/posterior/);
      await expect(service.create({ ...base, period: 'custom', startTime: '08:00', endTime: '08:00' }))
        .rejects.toThrow(/posterior/);
    });

    it('varias comunidades: un registro por comunidad, sin duplicados', async () => {
      communitiesRepository.find.mockResolvedValue([oak, pine]);
      const result = await service.create({ ...base, communityId: '5', communityIds: ['5', '8', '8'] });
      expect(result.blackouts.map((x) => x.communityId)).toEqual(['5', '8']);
    });

    it('todas las comunidades activas', async () => {
      communitiesRepository.find.mockResolvedValue([oak, pine]);
      const result = await service.create({ ...base, communityId: undefined, allCommunities: true });
      expect(communitiesRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
      expect(result.blackouts).toHaveLength(2);
    });

    it('sin comunidad o comunidad inexistente: 400', async () => {
      await expect(service.create({ ...base, communityId: undefined })).rejects.toThrow(/al menos una/);
      communitiesRepository.find.mockResolvedValue([]);
      await expect(service.create({ ...base, communityId: '99' })).rejects.toThrow(/no encontrada: 99/);
      expect(blackoutsRepository.save).not.toHaveBeenCalled();
    });

    it('devuelve servicios ya creados que caen dentro del bloqueo, segun la franja', async () => {
      servicesRepository.find.mockResolvedValue([
        { id: '100', communityId: '5', date: '2026-11-26', schedule: '09:00:00' },
        { id: '101', communityId: '5', date: '2026-11-26', schedule: '15:00:00' },
        { id: '102', communityId: '5', date: '2026-11-26', schedule: '00:00:00' },
      ]);
      const result = await service.create({ ...base, period: 'am' });
      expect(result.conflictingServices.map((s) => s.id)).toEqual(['100']);
    });
  });

  describe('findBlocking / assertServiceAllowed', () => {
    const thanksgiving = {
      id: '1', communityId: '5', startDate: '2026-11-26', endDate: '2026-11-26',
      period: 'full_day', startTime: null, endTime: null, reason: 'Thanksgiving',
    };

    it('sin comunidad o fecha no consulta', async () => {
      expect(await service.findBlocking({ communityId: null, date: '2026-11-26' })).toBeNull();
      expect(await service.findBlocking({ communityId: '5', date: null })).toBeNull();
      expect(blackoutsRepository.find).not.toHaveBeenCalled();
    });

    it('lanza 400 con el mensaje claro', async () => {
      blackoutsRepository.find.mockResolvedValue([thanksgiving]);
      await expect(service.assertServiceAllowed({ communityId: '5', date: '2026-11-26', schedule: '08:00:00' }))
        .rejects.toThrow(new BadRequestException('La comunidad Oak Park no trabaja el 2026-11-26 (Thanksgiving)'));
    });

    it('permite si la franja no coincide', async () => {
      blackoutsRepository.find.mockResolvedValue([{ ...thanksgiving, period: 'pm' }]);
      await expect(service.assertServiceAllowed({ communityId: '5', date: '2026-11-26', schedule: '08:00:00' }))
        .resolves.toBeUndefined();
    });

    it('permite si no hay bloqueos', async () => {
      await expect(service.assertServiceAllowed({ communityId: '5', date: '2026-11-26' })).resolves.toBeUndefined();
      expect(communitiesRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('assertServiceUpdateAllowed', () => {
    const blockedDay = [{
      id: '1', communityId: '5', startDate: '2026-11-26', endDate: '2026-11-26',
      period: 'full_day', startTime: null, endTime: null, reason: 'Thanksgiving',
    }];
    const existing = { id: '50', communityId: '5', date: '2026-11-26', schedule: '09:00:00' };

    beforeEach(() => {
      servicesRepository.findOne.mockResolvedValue(existing);
      blackoutsRepository.find.mockResolvedValue(blockedDay);
    });

    it('cambios que no mueven el servicio no se validan (estado, cleaner...)', async () => {
      await expect(service.assertServiceUpdateAllowed('50', {})).resolves.toBeUndefined();
      expect(servicesRepository.findOne).not.toHaveBeenCalled();
    });

    it('mandar la misma fecha/hora/comunidad no bloquea', async () => {
      await expect(service.assertServiceUpdateAllowed('50', {
        date: '2026-11-26', schedule: '09:00', communityId: '5',
      })).resolves.toBeUndefined();
      expect(blackoutsRepository.find).not.toHaveBeenCalled();
    });

    it('mover a un dia bloqueado: 400', async () => {
      servicesRepository.findOne.mockResolvedValue({ ...existing, date: '2026-11-25' });
      await expect(service.assertServiceUpdateAllowed('50', { date: '2026-11-26' }))
        .rejects.toThrow(/no trabaja el 2026-11-26/);
    });

    it('cambiar solo la hora dentro de un dia bloqueado: 400', async () => {
      await expect(service.assertServiceUpdateAllowed('50', { schedule: '10:00:00' }))
        .rejects.toThrow(BadRequestException);
    });

    it('cambiar a una comunidad con el dia bloqueado: 400', async () => {
      servicesRepository.findOne.mockResolvedValue({ ...existing, communityId: '8' });
      await expect(service.assertServiceUpdateAllowed('50', { communityId: '5' }))
        .rejects.toThrow(BadRequestException);
      expect(blackoutsRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ communityId: '5' }),
      }));
    });

    it('servicio inexistente: lo resuelve el update (404)', async () => {
      servicesRepository.findOne.mockResolvedValue(null);
      await expect(service.assertServiceUpdateAllowed('50', { date: '2026-11-26' })).resolves.toBeUndefined();
    });
  });

  describe('remove', () => {
    it('borra y devuelve el bloqueo', async () => {
      blackoutsRepository.findOne.mockResolvedValue({ id: '3' });
      await expect(service.remove('3')).resolves.toEqual({ id: '3' });
      expect(blackoutsRepository.delete).toHaveBeenCalledWith({ id: '3' });
    });
    it('404 si no existe', async () => {
      blackoutsRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('3')).rejects.toThrow(NotFoundException);
    });
  });

  describe('find', () => {
    it('filtra por comunidad y solapamiento de rango', async () => {
      await service.find({ communityId: '5', startDate: '2026-11-01', endDate: '2026-11-30' });
      const where = blackoutsRepository.find.mock.calls[0][0].where;
      expect(where.communityId).toBe('5');
      expect(where.endDate.value).toBe('2026-11-01');
      expect(where.startDate.value).toBe('2026-11-30');
    });
  });
});
