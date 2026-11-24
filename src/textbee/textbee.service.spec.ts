import axios from 'axios';
import { TextBeeService, SMS_RETRY_DELAYS_MS } from './textbee.service';

jest.mock('axios');
jest.mock('../config/env', () => ({ __esModule: true, default: { TEXTBEE_API_KEY: 'k', TEXTBEE_DEVICE_ID: 'd' } }));
const post = axios.post as jest.Mock;
const ok = { data: { data: { success: true, smsBatchId: 'b1' } } };
const err = (status?: number, headers: any = {}) =>
  Object.assign(new Error(status ? `status ${status}` : 'net'), status ? { response: { status, headers, data: {} } } : { code: 'ECONNRESET' });

describe('TextBeeService', () => {
  let svc: TextBeeService;
  let waits: number[];
  beforeEach(() => {
    post.mockReset();
    svc = new TextBeeService();
    waits = [];
    svc.sleep = async (ms) => { waits.push(ms); };
  });

  it('reintenta un 429 y termina enviando', async () => {
    post.mockRejectedValueOnce(err(429)).mockRejectedValueOnce(err(429)).mockResolvedValueOnce(ok);
    await expect(svc.sendSMS('+18633352203', 'hola')).resolves.toBe(true);
    expect(post).toHaveBeenCalledTimes(3);
    expect(waits).toEqual(expect.arrayContaining([SMS_RETRY_DELAYS_MS[0], SMS_RETRY_DELAYS_MS[1]]));
  });

  it('respeta Retry-After', async () => {
    post.mockRejectedValueOnce(err(429, { 'retry-after': '7' })).mockResolvedValueOnce(ok);
    await svc.sendSMS('+18633352203', 'x');
    expect(waits).toContain(7000);
  });

  it('no reintenta un 400 y se rinde tras agotar reintentos', async () => {
    post.mockRejectedValueOnce(err(400));
    await expect(svc.sendSMS('+18633352203', 'x')).resolves.toBe(false);
    expect(post).toHaveBeenCalledTimes(1);

    post.mockReset();
    post.mockRejectedValue(err(503));
    await expect(svc.sendSMS('+18633352203', 'x')).resolves.toBe(false);
    expect(post).toHaveBeenCalledTimes(SMS_RETRY_DELAYS_MS.length + 1);
  });

  it('envía en serie aunque se llame en paralelo (ráfaga del cron)', async () => {
    let inFlight = 0, max = 0;
    post.mockImplementation(async () => { inFlight++; max = Math.max(max, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return ok; });
    const r = await Promise.all(['+1', '+2', '+3', '+4'].map((p, i) => svc.sendSMS(`+1407705964${i}`, 'x')));
    expect(r).toEqual([true, true, true, true]);
    expect(max).toBe(1);
  });

  it('rechaza números inválidos sin llamar al gateway', async () => {
    await expect(svc.sendSMS('abc', 'x')).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
