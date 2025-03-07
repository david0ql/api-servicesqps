import { ApiProperty } from "@nestjs/swagger";
import { PageMetaDtoParameters } from "src/interfaces/page-meta-dto-parameters.dto";

export class PageMetaDto {
    @ApiProperty()
    readonly page: number;

    @ApiProperty()
    readonly take: number;

    @ApiProperty()
    readonly totalCount: number;

    @ApiProperty()
    readonly pageCount: number;

    @ApiProperty()
    readonly hasPreviousPage: boolean;

    @ApiProperty()
    readonly hasNextPage: boolean;

    constructor({ pageOptionsDto, totalCount }: PageMetaDtoParameters) {
        this.page = pageOptionsDto.page;
        this.take = pageOptionsDto.take;
        this.totalCount = totalCount;
        this.pageCount = Math.ceil(this.totalCount / this.take);
        this.hasPreviousPage = this.page > 1;
        this.hasNextPage = this.page < this.pageCount;
    }
}