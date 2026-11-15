import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import convert from 'heic-convert';

import { ApiPaginatedResponse } from '../../decorators/api-paginated-response.decorator';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { PageDto } from '../../dto/page.dto';
import { SearchDto } from '../../dto/search.dto';
import { NewsEntity } from '../../entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { isNewsAdmin, NewsService } from './news.service';

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const NEWS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'news');

const isHeicFile = (file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>) =>
  /^image\/hei[cf]$/i.test(file.mimetype) || /\.hei[cf]$/i.test(file.originalname);

/**
 * Portal "Last News".
 * - Admin (rol 1 / 9): CRUD + subida de imagen. Al publicar por primera vez se envia push (sin SMS).
 * - App: GET /news, GET /news/unread, POST /news/:id/accept.
 * Las imagenes se guardan en uploads/news y se sirven estaticas por /uploads (main.ts).
 */
@ApiBearerAuth()
@ApiTags('news')
@Controller('news')
export class NewsController {
  private readonly logger = new Logger(NewsController.name);

  constructor(private readonly newsService: NewsService) { }

  // ---------------------------------------------------------------- App

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findPublished(@Query() pageOptionsDto: PageOptionsDto, @Request() req: any) {
    return this.newsService.findPublishedForUser(pageOptionsDto, req.user.user);
  }

  @Get('unread')
  @UseGuards(AuthGuard('jwt'))
  findUnread(@Request() req: any) {
    return this.newsService.findUnreadForUser(req.user.user);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'))
  accept(@Param('id') id: string, @Request() req: any) {
    return this.newsService.accept(id, req.user.user);
  }

  // ---------------------------------------------------------------- Admin

  @Get('admin')
  @ApiPaginatedResponse(NewsEntity)
  @UseGuards(AuthGuard('jwt'))
  findAllAdmin(@Query() pageOptionsDto: PageOptionsDto, @Request() req: any): Promise<PageDto<NewsEntity>> {
    return this.newsService.findAllAdmin(pageOptionsDto, req.user.user);
  }

  @Post('search')
  @ApiPaginatedResponse(NewsEntity)
  @UseGuards(AuthGuard('jwt'))
  search(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto, @Request() req: any): Promise<PageDto<NewsEntity>> {
    return this.newsService.searchAdmin(searchDto, pageOptionsDto, req.user.user);
  }

  @Post('upload-image')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          if (!isNewsAdmin(req.user?.user)) {
            return cb(new ForbiddenException('Only administrators can upload news images.'), '');
          }
          mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });
          cb(null, NEWS_UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!/^image\//.test(file.mimetype) && !isHeicFile(file)) {
          return cb(new BadRequestException(`Invalid file type. Allowed: image/*. Received: ${file.mimetype}`), false);
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File | undefined, @Request() req: any) {
    this.newsService.assertAdmin(req.user.user);

    if (!file) {
      throw new BadRequestException('File is required.');
    }

    let filename = file.filename;

    if (isHeicFile(file)) {
      try {
        const jpegBuffer = await convert({
          buffer: await readFile(file.path),
          format: 'JPEG',
          quality: 0.9,
        });
        filename = file.filename.replace(/\.hei[cf]$/i, '.jpg');
        if (filename === file.filename) filename = `${file.filename}.jpg`;
        await writeFile(join(file.destination, filename), jpegBuffer);
        await unlink(file.path);
      } catch (error) {
        await unlink(file.path).catch(() => undefined);
        this.logger.error('HEIC conversion failed for news image', error);
        throw new BadRequestException('The HEIC image could not be processed.');
      }
    }

    return { imageUrl: `/uploads/news/${filename}` };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createNewsDto: CreateNewsDto, @Request() req: any) {
    return this.newsService.create(createNewsDto, req.user.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.newsService.findOne(id, req.user.user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateNewsDto: UpdateNewsDto, @Request() req: any) {
    return this.newsService.update(id, updateNewsDto, req.user.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @Request() req: any) {
    return this.newsService.remove(id, req.user.user);
  }
}
