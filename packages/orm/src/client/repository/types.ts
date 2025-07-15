import { Repository as TypeOrmRepository } from "typeorm";
import type { Entity } from "../types";

export type OrmRepository<T extends Entity> = TypeOrmRepository<T>;
