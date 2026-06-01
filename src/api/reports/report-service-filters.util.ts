import * as moment from 'moment-timezone';
import { ServicesEntity } from '../../entities/services.entity';

const QA_ROLE_ID = '7';
const QA_EXCLUDED_REPORT_WEEKDAYS = new Set([2, 4]);

export function shouldHideQaServiceFromPdfReports(service: ServicesEntity): boolean {
  const isQaService = service.user?.roleId === QA_ROLE_ID;
  if (!isQaService) {
    return false;
  }

  const serviceWeekday = moment.utc(service.date).isoWeekday();
  return QA_EXCLUDED_REPORT_WEEKDAYS.has(serviceWeekday);
}

export function filterQaTuesdayThursdayPdfServices(services: ServicesEntity[]): ServicesEntity[] {
  return services.filter(service => !shouldHideQaServiceFromPdfReports(service));
}
