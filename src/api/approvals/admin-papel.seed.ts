import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import envVars from '../../config/env';
import { ROLE_ADMIN_PAPEL, ROLE_ADMIN_PAPEL_NAME } from '../../constants/roles';
import { RolesEntity } from '../../entities/roles.entity';
import { UsersEntity } from '../../entities/users.entity';

/**
 * Seed idempotente al arrancar:
 *  - Crea el rol 9 "Admin Papel" si no existe.
 *  - Si vienen ADMIN_PAPEL_EMAIL y ADMIN_PAPEL_PASSWORD y no existe un usuario
 *    con ese email, lo crea con rol 9 (nombre ADMIN_PAPEL_NAME, teléfono
 *    ADMIN_PAPEL_PHONE). Nunca modifica usuarios existentes ni su contraseña.
 */
@Injectable()
export class AdminPapelSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminPapelSeed.name);

  constructor(
    @InjectRepository(RolesEntity)
    private readonly rolesRepository: Repository<RolesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
  ) { }

  async onApplicationBootstrap() {
    try {
      await this.ensureRole();
      await this.ensureUser();
    } catch (error) {
      this.logger.error(`Seed Admin Papel falló: ${error.message}`);
    }
  }

  async ensureRole() {
    const existing = await this.rolesRepository.findOne({ where: { id: ROLE_ADMIN_PAPEL } });
    if (existing) return false;
    await this.rolesRepository.insert({ id: ROLE_ADMIN_PAPEL, name: ROLE_ADMIN_PAPEL_NAME });
    this.logger.log(`Rol ${ROLE_ADMIN_PAPEL} "${ROLE_ADMIN_PAPEL_NAME}" creado.`);
    return true;
  }

  async ensureUser() {
    const email = envVars.ADMIN_PAPEL_EMAIL?.trim();
    const password = envVars.ADMIN_PAPEL_PASSWORD;
    if (!email || !password) return false;

    const existing = await this.usersRepository.findOne({ where: { email }, select: ['id', 'roleId'] });
    if (existing) {
      if (String(existing.roleId) !== ROLE_ADMIN_PAPEL) {
        this.logger.warn(`El usuario ${email} existe con rol ${existing.roleId}; no se modifica.`);
      }
      return false;
    }

    await this.usersRepository.save(this.usersRepository.create({
      name: (envVars.ADMIN_PAPEL_NAME || 'Administrador Papel').slice(0, 45),
      email,
      password: await bcrypt.hash(password, 10),
      phoneNumber: envVars.ADMIN_PAPEL_PHONE?.trim() || null,
      roleId: ROLE_ADMIN_PAPEL,
      isActive: true,
    }));
    this.logger.log(`Usuario Admin Papel ${email} creado.`);
    return true;
  }
}
