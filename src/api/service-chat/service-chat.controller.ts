import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { diskStorage } from 'multer';
import { extname, join, normalize, sep } from 'path';
import { mkdirSync } from 'fs';
import { createReadStream, existsSync } from 'fs';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

import { ServiceChatService } from './service-chat.service';
import { ServiceChatGateway } from './service-chat.gateway';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from '../../entities/users.entity';
import { Repository } from 'typeorm';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('service-chat')
@Controller('service-chats')
export class ServiceChatController {
  constructor(
    private readonly serviceChatService: ServiceChatService,
    private readonly serviceChatGateway: ServiceChatGateway,
    private readonly jwtService: JwtService,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
  ) {}

  @Get(':serviceId')
  @UseGuards(AuthGuard('jwt'))
  getHistory(@Param('serviceId') serviceId: string, @Request() req: any) {
    return this.serviceChatService.getChatHistory(serviceId, req.user.user);
  }

  @Post(':serviceId/evidence')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const serviceId = req.params?.serviceId;
          const targetPath = join(process.cwd(), 'uploads', 'service-chat', serviceId);
          mkdirSync(targetPath, { recursive: true });
          cb(null, targetPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadEvidence(
    @Param('serviceId') serviceId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE })
        .addFileTypeValidator({ fileType: /^(image|video)\// })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body('message') message: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    const attachmentType = file.mimetype.startsWith('image/') ? 'image' : 'video';
    const relativePath = join('uploads', 'service-chat', serviceId, file.filename);
    const normalizedPath = `/${relativePath.replace(/\\/g, '/')}`;

    const createdMessage = await this.serviceChatService.createMessage(
      serviceId,
      req.user.user,
      message ?? null,
      {
        path: normalizedPath,
        type: attachmentType,
        mime: file.mimetype,
        name: file.originalname,
      },
    );

    this.serviceChatGateway.broadcastMessage(serviceId, createdMessage);

    return createdMessage;
  }

  @Get(':serviceId/evidence/:messageId')
  async streamEvidence(
    @Param('serviceId') serviceId: string,
    @Param('messageId') messageId: string,
    @Query('token') tokenFromQuery: string | undefined,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const token = this.getToken(req, tokenFromQuery);
    if (!token) {
      throw new UnauthorizedException('Missing token.');
    }

    const payload = this.jwtService.verify(token);
    const user = await this.usersRepository.findOne({
      where: { id: payload.id },
      select: ['id', 'name', 'roleId'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const attachment = await this.serviceChatService.getAttachmentForMessage(
      serviceId,
      messageId,
      user,
    );

    const normalizedPath = normalize(attachment.path.replace(/^\/+/, ''));
    const baseDir = join(process.cwd(), 'uploads', 'service-chat');
    const absolutePath = join(process.cwd(), normalizedPath);

    const basePrefix = `${baseDir}${sep}`;
    if (!absolutePath.startsWith(basePrefix)) {
      throw new BadRequestException('Invalid attachment path.');
    }

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Attachment not found.');
    }

    if (attachment.mime) {
      res.setHeader('Content-Type', attachment.mime);
    }

    if (attachment.name) {
      res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"`);
    }

    const file = createReadStream(absolutePath);
    return new StreamableFile(file);
  }

  private getToken(req: any, tokenFromQuery?: string) {
    const headerToken = req.headers?.authorization;
    if (typeof headerToken === 'string' && headerToken.startsWith('Bearer ')) {
      return headerToken.slice(7);
    }

    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    return null;
  }
}
