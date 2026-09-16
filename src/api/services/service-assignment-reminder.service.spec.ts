import { ServiceStatusId } from '../../constants/service-status.enum';
import { ServicesEntity } from '../../entities/services.entity';
import { ServiceAssignmentReminderService } from './service-assignment-reminder.service';

describe('ServiceAssignmentReminderService', () => {
  const execute = jest.fn();
  const queryBuilder: any = {
    update: jest.fn(() => queryBuilder),
    set: jest.fn(() => queryBuilder),
    where: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    execute,
  };
  const repository: any = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const notifier: any = {
    notificarRecordatorioAsignacion: jest.fn(),
    notificarAsignacionVencida: jest.fn(),
  };
  const service = new ServiceAssignmentReminderService(repository, notifier);

  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockResolvedValue({ affected: 1 });
  });

  const pending = (minutes: number, stage = 0) => ({
    id: '10',
    userId: '4',
    assignedByUserId: '1',
    statusId: ServiceStatusId.Pending,
    assignedAt: new Date(Date.now() - minutes * 60_000),
    assignmentReminderStage: stage,
  } as ServicesEntity);

  it.each([
    [30, 1],
    [90, 2],
    [150, 3],
  ])('envia el recordatorio correspondiente a los %i minutos', async (minutes, stage) => {
    repository.find.mockResolvedValue([pending(minutes)]);
    await service.processPendingAssignments();
    expect(notifier.notificarRecordatorioAsignacion).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10' }),
      stage,
    );
    expect(notifier.notificarAsignacionVencida).not.toHaveBeenCalled();
  });

  it('libera y avisa al administrador a las tres horas', async () => {
    repository.find.mockResolvedValue([pending(180, 3)]);
    await service.processPendingAssignments();
    expect(queryBuilder.set).toHaveBeenCalledWith(expect.objectContaining({
      statusId: ServiceStatusId.Created,
      userId: null,
    }));
    expect(notifier.notificarAsignacionVencida).toHaveBeenCalledTimes(1);
  });

  it('no repite una etapa ya enviada', async () => {
    repository.find.mockResolvedValue([pending(95, 2)]);
    await service.processPendingAssignments();
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    expect(notifier.notificarRecordatorioAsignacion).not.toHaveBeenCalled();
  });
});
