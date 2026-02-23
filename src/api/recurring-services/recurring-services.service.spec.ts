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
