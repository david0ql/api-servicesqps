import { ServicesEntity } from '../../entities/services.entity';
import { filterQaTuesdayThursdayPdfServices } from './report-service-filters.util';

const buildService = (id: string, date: string, roleId: string): ServicesEntity => ({
  id,
  date,
  user: { roleId } as any,
} as ServicesEntity);

describe('report service filters', () => {
  it('excludes QA services on Tuesday and Thursday from PDF reports', () => {
    const services = [
      buildService('1', '2026-06-02', '7'),
      buildService('2', '2026-06-04', '7'),
      buildService('3', '2026-06-03', '7'),
      buildService('4', '2026-06-02', '4'),
      buildService('5', '2026-06-04', '4'),
    ];

    expect(filterQaTuesdayThursdayPdfServices(services).map(service => service.id)).toEqual([
      '3',
      '4',
      '5',
    ]);
  });
});
