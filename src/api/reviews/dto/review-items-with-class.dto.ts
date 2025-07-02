import { ApiProperty } from '@nestjs/swagger';

export class ReviewItemDto {
  @ApiProperty({ description: 'Review item ID' })
  id: string;

  @ApiProperty({ description: 'Review item name' })
  name: string;
}

export class ReviewItemsGroupedByClassDto {
  @ApiProperty({ description: 'Review class name' })
  reviewClassName: string;

  @ApiProperty({ description: 'Review class ID' })
  reviewClassId: string;

  @ApiProperty({ description: 'Array of review items', type: [ReviewItemDto] })
  reviewItems: ReviewItemDto[];
} 