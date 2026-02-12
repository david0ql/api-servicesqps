import { ApiProperty } from '@nestjs/swagger';

export class ServiceChatThreadLastMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  userId: string | null;

  @ApiProperty({ nullable: true })
  userName: string | null;

  @ApiProperty({ nullable: true })
  message: string | null;

  @ApiProperty()
  hasAttachment: boolean;

  @ApiProperty({ nullable: true })
  attachmentType: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class ServiceChatThreadDto {
  @ApiProperty()
  serviceId: string;

  @ApiProperty({ nullable: true })
  statusId: string | null;

  @ApiProperty()
  date: string;

  @ApiProperty({ nullable: true })
  schedule: string | null;

  @ApiProperty({ nullable: true })
  communityName: string | null;

  @ApiProperty({ nullable: true })
  unitNumber: string | null;

  @ApiProperty({ nullable: true })
  cleanerName: string | null;

  @ApiProperty({ type: () => ServiceChatThreadLastMessageDto })
  lastMessage: ServiceChatThreadLastMessageDto;
}

