import { ApiExtraModels, ApiOkResponse, getSchemaPath } from "@nestjs/swagger";
import { applyDecorators, Type } from "@nestjs/common";
import { PageDto } from "src/dto/page.dto";

export const ApiPaginatedResponse = <TModel extends Type<any>>(
    model: TModel,
) => {
    return applyDecorators(
        ApiExtraModels(PageDto, model),
        ApiOkResponse({
            description: "Successfully received model list",
            schema: {
                allOf: [
                    { $ref: getSchemaPath(PageDto) },
                    {
                        properties: {
                            data: {
                                type: "array",
                                items: { $ref: getSchemaPath(model) },
                            },
                        },
                    },
                ],
            },
        }),
    );
};