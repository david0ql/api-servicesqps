import {
    ManyToOne,
    OneToOne,
    ManyToMany,
    OneToMany,
    RelationOptions,
    ObjectType,
} from "typeorm";

export function ManyToOneNoAction<T>(
    type: () => ObjectType<T>,
    inverseSide: (object: T) => any,
    options: RelationOptions = {}
): PropertyDecorator {
    return ManyToOne(type, inverseSide, {
        onDelete: "NO ACTION",
        onUpdate: "NO ACTION",
        ...options,
    });
}

export function OneToOneNoAction<T>(
    type: () => ObjectType<T>,
    inverseSide: (object: T) => any,
    options: RelationOptions = {}
): PropertyDecorator {
    return OneToOne(type, inverseSide, {
        onDelete: "NO ACTION",
        onUpdate: "NO ACTION",
        ...options,
    });
}

export function ManyToManyNoAction<T>(
    type: () => ObjectType<T>,
    inverseSide: (object: T) => any,
    options: RelationOptions = {}
): PropertyDecorator {
    return ManyToMany(type, inverseSide, {
        onDelete: "NO ACTION",
        onUpdate: "NO ACTION",
        ...options,
    });
}

export function OneToManyNoAction<T>(
    type: () => ObjectType<T>,
    inverseSide: (object: T) => any,
    options: RelationOptions = {}
): PropertyDecorator {
    return OneToMany(type, inverseSide, {
        onDelete: "NO ACTION",
        onUpdate: "NO ACTION",
        ...options,
    });
}
