import { normalizeCommunityContacts } from './community-contacts.util';

describe('normalizeCommunityContacts', () => {
  it('recorta espacios de nombres y telefonos', () => {
    expect(
      normalizeCommunityContacts({ technicianName: '  Juan ', technicianPhone: ' +1 407 555 0101 ' }),
    ).toEqual({ technicianName: 'Juan', technicianPhone: '+1 407 555 0101' });
  });

  it('convierte strings vacios o solo espacios en null', () => {
    expect(
      normalizeCommunityContacts({ maintenanceSupervisorName: '', managerContactPhone: '   ' }),
    ).toEqual({ maintenanceSupervisorName: null, managerContactPhone: null });
  });

  it('mantiene null explicito para poder borrar un contacto', () => {
    expect(normalizeCommunityContacts({ managerContactName: null })).toEqual({ managerContactName: null });
  });

  it('no agrega campos ausentes ni toca el resto del dto', () => {
    const dto = { communityName: 'Oak Park', showContactsInApp: true };
    const result = normalizeCommunityContacts(dto);
    expect(result).toEqual({ communityName: 'Oak Park', showContactsInApp: true });
    expect(result).not.toHaveProperty('technicianName');
    expect(result).not.toBe(dto);
  });
});
