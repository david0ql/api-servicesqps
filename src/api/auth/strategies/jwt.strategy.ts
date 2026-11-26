import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';

import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { passwordChangeRequiredBody, shouldBlockForPasswordChange } from '../password-change.util';

import envVars from 'src/config/env';
import { UsersEntity } from 'src/entities/users.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor(
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: envVars.JWT_SECRET,
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: JwtPayload): Promise<{ user: UsersEntity }> {
        const { id } = payload;

        const user = await this.usersRepository.findOne({
            where: {
                id,
            }
        })

        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not found');
        }

        // Cambio de clave obligatorio: solo deja pasar las rutas de la allowlist.
        // 403 (no 401) para que el cliente no lo confunda con sesión vencida.
        if (shouldBlockForPasswordChange(user, req?.method, req?.originalUrl ?? req?.url)) {
            throw new ForbiddenException(passwordChangeRequiredBody());
        }

        delete user.password;

        return {
            user,
        };
    }
}
