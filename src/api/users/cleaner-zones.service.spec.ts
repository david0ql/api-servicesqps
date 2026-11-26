import { CleanerNotEligibleException, CleanerZonesService } from './cleaner-zones.service';

const square = [[-81.5, 28.4], [-81.3, 28.4], [-81.3, 28.6], [-81.5, 28.6], [-81.5, 28.4]];
const zones = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [square] } }] };

const GRACE = new Date('2026-12-01T15:00:00Z');
const ENFORCED = new Date('2026-12-17T15:00:00Z');

describe('CleanerZonesService', () => {
  const users: Record<string, any> = {
    ana: { id: 'ana', name: 'Ana', roleId: '4', isActive: true, workZones: zones, hasWorkZone: true },
    bea: { id: 'bea', name: 'Bea', roleId: '4', isActive: true, workCompanyIds: ['9'], hasWorkZone: true },
    caro: { id: 'caro', name: 'Caro', roleId: '4', isActive: true, hasWorkZone: false },
    qa: { id: 'qa', name: 'Quinn', roleId: '7', isActive: true, hasWorkZone: false },
  };
  const communities: Record<string, any> = {
    c1: { id: 'c1', communityName: 'Oak', companyId: '1', latitude: '28.5', longitude: '-81.4' },
    c2: { id: 'c2', communityName: 'Pine', companyId: '9', latitude: null, longitude: null },
  };
  const usersRepository: any = {
    findOne: jest.fn(async ({ where }) => users[where.id] ?? null),
    find: jest.fn(async () => Object.values(users)),
    update: jest.fn(),
  };
  const communitiesRepository: any = { findOne: jest.fn(async ({ where }) => communities[where.id] ?? null) };
  const service = new CleanerZonesService(usersRepository, communitiesRepository, '2026-12-16');

  beforeEach(() => jest.clearAllMocks());

  it('periodo de gracia: todas las cleaners aparecen y no se valida', async () => {
    const result = await service.findEligibleAssignees('c1', GRACE);
    expect(result.enforced).toBe(false);
    expect(result.data.map((u) => u.id)).toEqual(['ana', 'bea', 'caro', 'qa']);
    await expect(service.assertEligible('caro', 'c1', GRACE)).resolves.toBeUndefined();
    expect(usersRepository.findOne).not.toHaveBeenCalled();
  });

  it('en vigor: solo las elegibles (QA siempre)', async () => {
    expect((await service.findEligibleAssignees('c1', ENFORCED)).data.map((u) => u.id)).toEqual(['ana', 'qa']);
    expect((await service.findEligibleAssignees('c2', ENFORCED)).data.map((u) => u.id)).toEqual(['bea', 'qa']);
  });

  it('en vigor: rechaza con 400 a la cleaner no elegible', async () => {
    await expect(service.assertEligible('caro', 'c1', ENFORCED)).rejects.toBeInstanceOf(CleanerNotEligibleException);
    await expect(service.assertEligible('caro', 'c1', ENFORCED)).rejects.toThrow(/Caro.*Oak/);
    await expect(service.assertEligible('ana', 'c1', ENFORCED)).resolves.toBeUndefined();
    await expect(service.assertEligible('qa', 'c1', ENFORCED)).resolves.toBeUndefined();
    await expect(service.assertEligible(null, 'c1', ENFORCED)).resolves.toBeUndefined();
  });

  it('updateWorkZone normaliza, guarda y recalcula hasWorkZone', async () => {
    await service.updateWorkZone('caro', { communityIds: ['5', 5 as any], zones: null });
    expect(usersRepository.update).toHaveBeenCalledWith('caro', expect.objectContaining({
      workCommunityIds: ['5'], workCompanyIds: [], workZones: null, hasWorkZone: true,
    }));
    await service.updateWorkZone('caro', { communityIds: [], companyIds: [] });
    expect(usersRepository.update).toHaveBeenLastCalledWith('caro', expect.objectContaining({ hasWorkZone: false }));
  });

  it('updateWorkZone responde 400 con GeoJSON invalido', async () => {
    await expect(service.updateWorkZone('caro', { zones: { type: 'Point', coordinates: [0, 0] } }))
      .rejects.toThrow(/poligonos/);
  });
});
