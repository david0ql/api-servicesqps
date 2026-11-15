import { Body, Controller, Get, HttpCode, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { SkipApproval } from '../../decorators/skip-approval.decorator';
import { ApprovalsService } from './approvals.service';
import { ApprovalsQueryDto } from './dto/approvals-query.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';

@ApiBearerAuth()
@ApiTags('approvals')
@Controller('approvals')
@SkipApproval()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) { }

  /** Público (el token del SMS es la credencial): ver la solicitud del enlace. */
  @Get('link/:token')
  linkView(@Param('token') token: string) {
    return this.approvalsService.getLinkView(token);
  }

  /** Público: aprobar o rechazar desde el enlace del SMS. Un solo uso. */
  @Post('link/:token/approve')
  @HttpCode(200)
  approveFromLink(@Param('token') token: string, @Body() body: DecideApprovalDto) {
    return this.approvalsService.decideFromLink(token, 'approve', body?.comment);
  }

  @Post('link/:token/reject')
  @HttpCode(200)
  rejectFromLink(@Param('token') token: string, @Body() body: DecideApprovalDto) {
    return this.approvalsService.decideFromLink(token, 'reject', body?.comment);
  }

  /** Super admin: todas. Admin Papel: solo las suyas. */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  list(@Query() query: ApprovalsQueryDto, @Request() req: any) {
    return this.approvalsService.list(req.user.user, query);
  }

  /** Admin Papel: reenviar el SMS de una solicitud suya pendiente. */
  @Post(':id/remind')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  remind(@Param('id') id: string, @Request() req: any) {
    return this.approvalsService.remind(id, req.user.user);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  approve(@Param('id') id: string, @Body() body: DecideApprovalDto, @Request() req: any) {
    return this.approvalsService.decideFromWeb(id, req.user.user, 'approve', body?.comment);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  reject(@Param('id') id: string, @Body() body: DecideApprovalDto, @Request() req: any) {
    return this.approvalsService.decideFromWeb(id, req.user.user, 'reject', body?.comment);
  }
}
