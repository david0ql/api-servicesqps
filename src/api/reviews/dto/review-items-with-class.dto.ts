import { ApiProperty } from '@nestjs/swagger';

export class ReviewItemsWithClassDto {
  @ApiProperty({ description: 'Review item ID' })
  id: string;

  @ApiProperty({ description: 'Review item name' })
  name: string;

  @ApiProperty({ description: 'Review class ID' })
  reviewClassId: string;

  @ApiProperty({ description: 'Review class name' })
  reviewClassName: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
} 