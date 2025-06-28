import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import moment from 'moment';

import { ServicesByManagerDto } from './dto/services-by-manager.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

import { ServicesEntity } from '../../entities/services.entity';
import { ExtrasByServiceEntity } from '../../entities/extras_by_service.entity';
import { SearchDto } from '../../dto/search.dto';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';
import { PushNotificationsService } from '../../push-notification/push-notification.service';
import { UsersEntity } from '../../entities/users.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';

export interface ServicesDashboard extends ServicesEntity {
  totalCleaner: number;
  totalParner: any;
  total: any;
}

@Injectable()
export class ServicesService {

  constructor(
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(ExtrasByServiceEntity)
    private readonly extrasByServiceRepository: Repository<ExtrasByServiceEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    @InjectRepository(CommunitiesEntity)
    private readonly communitiesRepository: Repository<CommunitiesEntity>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) { }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<ServicesEntity>> {
    const searchedItemsByWord = this.servicesRepository.createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .orderBy('services.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where('services.date LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('services.schedule LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('services.comment LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('services.userComment LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('services.unitySize LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('services.unitNumber LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount()

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<ServicesDashboard>> {
    const queryBuilder = this.servicesRepository.createQueryBuilder('services')

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .orderBy('services.date', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)

    const [items, totalCount] = await queryBuilder.getManyAndCount()

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    const servicesDashboard = items.map(service => {
      const totalExtrasByService = service.extrasByServices?.reduce((acc, extraByService) => {
        const commission = extraByService.extra?.commission;
        return acc + (commission ? Number(commission) : 0);
      }, 0) ?? 0;
    
      const typeCommission = service.type?.commission ?? 0;
      const typePrice = service.type?.price ?? 0;
    
      const totalCleaner = Number(totalExtrasByService) + Number(typeCommission);
      const totalNotAdjusted = Number(typePrice) - Number(typeCommission) - Number(totalExtrasByService);
    
      const totalParner = totalNotAdjusted * 0.4;
      const total = totalNotAdjusted * 0.6;
    
      return {
        ...service,
        totalCleaner,
        totalParner,
        total,
      };
    });
    

    return new PageDto(servicesDashboard, pageMetaDto);
  }

  async findAllByStatusID(statusID: string, pageOptionsDto: PageOptionsDto): Promise<PageDto<ServicesEntity>> {
    const queryBuilder = this.servicesRepository.createQueryBuilder('services')

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .orderBy('services.date', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where('services.statusId = :statusID', { statusID })

    const [items, totalCount] = await queryBuilder.getManyAndCount()

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAllByUserIDStatusID(userID: string, statusID: string, pageOptionsDto: PageOptionsDto): Promise<PageDto<ServicesEntity>> {
    const queryBuilder = this.servicesRepository.createQueryBuilder('services')

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .orderBy('services.date', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where('services.statusId = :statusID', { statusID })
      .andWhere('services.userId = :userID', { userID })

    const [items, totalCount] = await queryBuilder.getManyAndCount()

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const queryBuilder = await this.servicesRepository.createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.id = :id', { id })
      .getOne()

    if (!queryBuilder) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return queryBuilder;
  }

  async findByCleaner(userId: string, pageOptionsDto: PageOptionsDto): Promise<PageDto<ServicesEntity>> {
    const queryBuilder = this.servicesRepository.createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.userId = :userId', { userId })
      .orderBy('services.date', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)

    const [items, totalCount] = await queryBuilder.getManyAndCount()

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findByCommunities(
    servicesByManagerDto: ServicesByManagerDto,
    pageOptionsDto: PageOptionsDto,
  ): Promise<PageDto<ServicesEntity>> {
    const queryBuilder = this.servicesRepository.createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.communityId IN (:...communities)', { communities: servicesByManagerDto.communities })
      .orderBy('services.date', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take);

    if (servicesByManagerDto.statusID !== undefined) {
      queryBuilder.andWhere('services.statusId = :statusID', { statusID: servicesByManagerDto.statusID });
    }

    const [items, totalCount] = await queryBuilder.getManyAndCount();
    
    // Set commission to 0 if it exists in type
    const modifiedItems = items.map(service => {
      if (service.type && service.type.commission !== undefined) {
        service.type = {
          ...service.type,
          commission: 0
        };
      }
      return service;
    });

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(modifiedItems, pageMetaDto);
  }

  async findByStatus(
    servicesByManagerDto: ServicesByManagerDto,
    statusID: string,
    pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<ServicesEntity>> {
    const queryBuilder = this.servicesRepository.createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.communityId IN (:...communities)', { communities: servicesByManagerDto.communities })
      .andWhere('services.statusId = :statusID', { statusID })
      .orderBy('services.date', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)

    const [items, totalCount] = await queryBuilder.getManyAndCount()

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findByCleanerAndDate(userId: string, date: string) {
    const startOfWeek = moment(date).startOf('isoWeek').format('YYYY-MM-DD');
    const endOfWeek = moment(date).endOf('isoWeek').format('YYYY-MM-DD');

    const queryBuilder = this.servicesRepository.createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.userId = :userId', { userId })
      .andWhere('services.date BETWEEN :startOfWeek AND :endOfWeek', { startOfWeek, endOfWeek })

    return queryBuilder.getMany();
  }

  async create(createServiceDto: CreateServiceDto) {
    const { extraId, ...createServiceDtoCopy } = createServiceDto;
    
    // Log detallado del DTO
    console.log('=== Create Service DTO Details ===');
    console.log('Full DTO:', JSON.stringify(createServiceDto, null, 2));
    console.log('ExtraId:', extraId);
    console.log('DTO without extraId:', JSON.stringify(createServiceDtoCopy, null, 2));
    console.log('===============================');

    const service = this.servicesRepository.create(createServiceDtoCopy);
    await this.servicesRepository.save(service);

    // Manejar extras
    let extras = [];
    if (Array.isArray(extraId) && extraId.length > 0) {
      extras = extraId.map(id =>
        this.extrasByServiceRepository.create({ serviceId: service.id, extraId: id })
      );
      await this.extrasByServiceRepository.save(extras);
    }

    const fullService = await this.servicesRepository.findOne({
      where: { id: service.id },
      relations: ['community', 'status', 'type'],
    });

    // Obtener el usuario que está creando el servicio
    const creatingUser = await this.usersRepository.findOne({
      where: { id: createServiceDto.userId },
      select: ['id', 'token', 'phoneNumber', 'name', 'roleId'],
    });

    // Obtener super admins
    const superAdmins = await this.usersRepository.find({
      where: { roleId: '1' },
      select: ['id', 'token', 'phoneNumber', 'name', 'roleId'],
    });

    // Obtener manager y supervisor de la comunidad
    const community = await this.communitiesRepository.findOne({
      where: { id: service.communityId },
      relations: ['supervisorUser', 'managerUser'],
    });

    const communityUsers = [
      community?.supervisorUser,
      community?.managerUser
    ].filter(Boolean);

    // Combinar todos los usuarios que deben recibir notificación
    const allUsers = [
      creatingUser,
      ...superAdmins,
      ...communityUsers
    ].filter(Boolean);

    // Filtrar usuarios según el status y su rol (para creación, status es 1 - Created)
    const filteredUsers = allUsers.filter(user => {
      const statusId = fullService.status?.id; // Status 1 - Created
      const userRoleId = user?.roleId;

      // Si el status es 1 (Created), 2 (Pending) o 5 (Completed), todos los usuarios reciben notificación
      if (statusId === '1' || statusId === '2' || statusId === '5') {
        return true;
      }

      // Para otros status (3, 4, 6), managers (roleId: '3') y supervisores (roleId: '6') NO reciben notificación
      if (userRoleId === '3' || userRoleId === '6') {
        return false;
      }

      // Para otros roles, reciben notificación para todos los status
      return true;
    });

    // Separar usuarios con token y teléfono
    const usersWithToken = filteredUsers
      .filter(user => user?.token && user.token.trim() !== '')
      .filter((user, index, self) => 
        self.findIndex(u => u.token === user.token) === index
      );

    const usersWithPhone = filteredUsers
      .filter(user => user?.phoneNumber && user.phoneNumber.trim() !== '')
      .filter((user, index, self) => 
        self.findIndex(u => u.phoneNumber === user.phoneNumber) === index
      );

    console.log('Filtered users by role and status (create):', filteredUsers.map(u => ({ 
      id: u.id, 
      name: u.name, 
      roleId: u.roleId, 
      token: u.token ? 'has_token' : 'no_token',
      phone: u.phoneNumber ? 'has_phone' : 'no_phone'
    })));
    console.log('Users with token:', usersWithToken);
    console.log('Users with phone:', usersWithPhone);

    const notification = {
      body: `New service created for ${fullService.community?.communityName ?? 'Unknown Community'} on ${moment(fullService.date).format('DD/MM/YYYY')} in apartment number ${fullService.unitNumber}`,
      title: 'New Service Created',
      data: {
        serviceId: service.id,
        serviceType: service.type,
        serviceDate: service.date,
        serviceStatus: service.status,
      },
      tokensNotification: {
        tokens: usersWithToken.map(user => user.token),
        users: usersWithPhone
      }
    };

    // Enviar notificaciones
    await this.pushNotificationsService.sendNotification(notification);

    return {
      service: fullService,
      extras,
    };
  }

  async update(id: string, updateServiceDto: UpdateServiceDto) {
    const service = await this.servicesRepository.preload({
      id,
      ...updateServiceDto,
    });
  
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
  
    if (updateServiceDto.extraId) {
      const existingExtras = await this.extrasByServiceRepository.find({
        where: { serviceId: id },
      });
  
      const extrasToRemove = existingExtras.filter(
        extra => !updateServiceDto.extraId.includes(extra.extraId)
      );
  
      if (extrasToRemove.length > 0) {
        await this.extrasByServiceRepository.remove(extrasToRemove);
      }
  
      const extrasToAdd = updateServiceDto.extraId.filter(
        extraId => !existingExtras.some(extra => extra.extraId === extraId)
      );
  
      if (extrasToAdd.length > 0) {
        const newExtras = extrasToAdd.map(extraId =>
          this.extrasByServiceRepository.create({ serviceId: id, extraId })
        );
        await this.extrasByServiceRepository.save(newExtras);
      }
    }
  
    await this.servicesRepository.save(service);
  
    const fullService = await this.servicesRepository.findOne({
      where: { id },
      relations: ['community', 'status', 'user', 'type'],
    });
  
    if (!fullService) {
      throw new NotFoundException(`Service with ID ${id} not found after update`);
    }
  
    const statusMessages: Record<string, string> = {
      '2': `You have a new service for ${moment(fullService.date).format('DD/MM/YYYY')} in ${fullService.community?.communityName ?? 'Unknown Community'}`,
      '3': `Approved by ${fullService.user?.name ?? 'Unknown'} in ${fullService.community?.communityName ?? 'Unknown Community'} for ${moment(fullService.date).format('DD/MM/YYYY')}`,
      '4': `The cleaner ${fullService.user?.name ?? 'Unknown'} has rejected the service in ${fullService.community?.communityName ?? 'Unknown Community'} on ${moment(fullService.date).format('DD/MM/YYYY')}`,
      '5': `Finished by ${fullService.user?.name ?? 'Unknown'} in ${fullService.community?.communityName ?? 'Unknown Community'} on ${moment(fullService.date).format('DD/MM/YYYY')}`,
    };
  
    const statusMessage = statusMessages[fullService.status?.id];
  
    if (!statusMessage) {
      throw new NotFoundException(`Status message not found for status ID ${fullService.status?.id}`);
    }
    const notification = {
      body: statusMessage,
      title: 'Service Status Updated',
      data: {
        serviceId: fullService.id,
        serviceType: fullService.type,
        serviceDate: fullService.date,
        serviceStatus: fullService.status,
      },
    };
  
    this.notifyInterestedParticipants(fullService, notification);
  
    return fullService;
  }

  async remove(id: string) {
    const service = await this.servicesRepository.findOne({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    const notification = {
      body: `The service with ID: ${service.id} has been removed`,
      title: 'Service Removed',
      data: {
        serviceId: service.id,
        serviceType: service.type,
        serviceDate: service.date,
        serviceStatus: service.status,
      },
    };

    this.notifyInterestedParticipants(service, notification)

    return this.servicesRepository.remove(service);
  }

  private async notifyInterestedParticipants(
    service: ServicesEntity,
    notification: { body: string; title: string; data: any }
  ) {
    const superAdmins = await this.usersRepository.find({
      where: { roleId: '1' },
      select: ['id', 'token', 'phoneNumber', 'roleId'],
    });

    const communities = await this.communitiesRepository.find({
      where: { id: service.communityId },
      relations: ['supervisorUser', 'managerUser'],
    });

    const communityUserIds = communities
      .flatMap(c => [c.supervisorUser?.id, c.managerUser?.id])
      .filter(Boolean);

    const fullCommunityUsers = communityUserIds.length
      ? await this.usersRepository.findBy({
        id: In(communityUserIds),
      })
      : [];

    let serviceUser = null;
    if (service.user?.id) {
      serviceUser = await this.usersRepository.findOne({
        where: { id: service.user.id },
        select: ['id', 'token', 'phoneNumber', 'roleId'],
      });
    }

    // Separar usuarios con token y usuarios con teléfono
    const allUsers = [
      ...(serviceUser ? [serviceUser] : []),
      ...superAdmins,
      ...fullCommunityUsers,
    ];

    // Filtrar usuarios según el status y su rol
    const filteredUsers = allUsers.filter(user => {
      const statusId = service.status?.id;
      const userRoleId = user?.roleId;

      // Si el status es 1 (Created), 2 (Pending) o 5 (Completed), todos los usuarios reciben notificación
      if (statusId === '1' || statusId === '2' || statusId === '5') {
        return true;
      }

      // Para otros status (3, 4, 6), managers (roleId: '3') y supervisores (roleId: '6') NO reciben notificación
      if (userRoleId === '3' || userRoleId === '6') {
        return false;
      }

      // Para otros roles, reciben notificación para todos los status
      return true;
    });

    // Usuarios con token válido para push notifications
    const usersWithToken = filteredUsers
      .filter(user => user?.token && user.token.trim() !== '')
      .filter((user, index, self) => 
        self.findIndex(u => u.token === user.token) === index
      );

    // Usuarios con número de teléfono para SMS
    const usersWithPhone = filteredUsers
      .filter(user => user?.phoneNumber && user.phoneNumber.trim() !== '')
      .filter((user, index, self) => 
        self.findIndex(u => u.phoneNumber === user.phoneNumber) === index
      );

    console.log('Filtered users by role and status:', filteredUsers.map(u => ({ 
      id: u.id, 
      name: u.name, 
      roleId: u.roleId, 
      token: u.token ? 'has_token' : 'no_token',
      phone: u.phoneNumber ? 'has_phone' : 'no_phone'
    })));
    console.log('Users with token:', usersWithToken.map(u => ({ id: u.id, name: u.name, roleId: u.roleId, token: u.token })));
    console.log('Users with phone:', usersWithPhone.map(u => ({ id: u.id, name: u.name, roleId: u.roleId, phone: u.phoneNumber })));

    const uniqueTokens = usersWithToken.map(u => u.token);

    return this.pushNotificationsService.sendNotification({
      body: notification.body,
      title: notification.title,
      data: notification.data,
      sound: 'default',
      tokensNotification: {
        tokens: uniqueTokens,
        users: usersWithPhone, // Enviamos todos los usuarios con teléfono para SMS
      },
    });
  }
}
