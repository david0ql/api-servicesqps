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

  /** Super admin: todas. Admin Papel: solo las suyas. */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  list(@Query() query: ApprovalsQueryDto, @Request() req: any) {
    return this.approvalsService.list(req.user.user, query);
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
