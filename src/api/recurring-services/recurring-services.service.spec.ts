describe('RecurringServicesService', () => {
  it('builds next week window when run on Sunday at 6 PM', () => {
    const moment = require('moment');

    const reference = moment('2026-02-15 18:00:00', 'YYYY-MM-DD HH:mm:ss');
    const weekStart = moment(reference).add(1, 'week').startOf('isoWeek');
    const weekEnd = moment(weekStart).endOf('isoWeek');

    expect(weekStart.format('YYYY-MM-DD')).toBe('2026-02-16');
    expect(weekEnd.format('YYYY-MM-DD')).toBe('2026-02-22');
  });
});

// Evita cargar la cadena de ServicesService (lee variables de entorno al importar).
jest.mock('../services/services.service', () => ({ ServicesService: class {} }));

describe('RecurringServicesService.generateWeeklyServices con dias fuera de servicio', () => {
  const { RecurringServicesService } = require('./recurring-services.service');

  const recurringRepository: any = { find: jest.fn() };
  const servicesRepository: any = { findOne: jest.fn() };
  const usersRepository: any = {};
  const servicesService: any = { create: jest.fn() };
  const blackouts: any = { findBlocking: jest.fn() };
  const service = new RecurringServicesService(
    recurringRepository, servicesRepository, usersRepository, servicesService, blackouts,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 22, 18, 0, 0)); // domingo 22/11/2026
    recurringRepository.find.mockResolvedValue([{
      id: '7', communityId: '5', typeId: '1', statusId: '1', schedule: '09:00:00',
      startDate: '2026-11-01', daysOfWeek: ['wed', 'thu', 'fri'], extraIds: [],
      unitNumber: '101', unitySize: '1BR', isActive: true,
    }]);
    servicesRepository.findOne.mockResolvedValue(null);
    servicesService.create.mockResolvedValue({});
  });

  afterEach(() => jest.useRealTimers());

  it('salta solo el dia bloqueado (Thanksgiving) y crea el resto', async () => {
    blackouts.findBlocking.mockImplementation(async ({ date }) => (date === '2026-11-26'
      ? { blackout: {}, message: 'La comunidad Oak no trabaja el 2026-11-26 (Thanksgiving)' }
      : null));

    await service.generateWeeklyServices();

    expect(blackouts.findBlocking).toHaveBeenCalledWith({ communityId: '5', date: '2026-11-26', schedule: '09:00:00' });
    const created = servicesService.create.mock.calls.map(([payload]) => payload.date);
    expect(created).toEqual(['2026-11-25', '2026-11-27']);
  });

  it('si un create falla igual, sigue con los demas', async () => {
    blackouts.findBlocking.mockResolvedValue(null);
    servicesService.create.mockRejectedValueOnce(new Error('boom'));
    await service.generateWeeklyServices();
    expect(servicesService.create).toHaveBeenCalledTimes(3);
  });
});
