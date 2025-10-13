import type { AggregateOptions, AggregatePayload } from "./aggregate";
import type { Entity, ID, Options } from "./base";
import type {
  BulkDeleteOptions,
  BulkUpdateOptions,
  CreateOptions,
  DeleteOptions,
  UpdateOptions,
} from "./crud";
import type { Payload, QueryOptions } from "./query";

// ============================================================================
// Repository Interface
// ============================================================================

export interface Repository<T extends Entity> {
  readonly name: string;

  find<U extends QueryOptions<T>>(): Promise<Payload<T, U>[]>;
  find<U extends QueryOptions<T>>(
    args: Options<U, QueryOptions<T>>,
  ): Promise<Payload<T, U>[]>;

  findOne<U extends QueryOptions<T>>(): Promise<Payload<T, U> | null>;
  findOne<U extends QueryOptions<T>>(
    args: Options<U, QueryOptions<T>>,
  ): Promise<Payload<T, U> | null>;

  create<U extends CreateOptions<T>>(
    args: Options<U, CreateOptions<T>>,
  ): Promise<Payload<T, U>>;

  update<U extends UpdateOptions<T>>(
    args: Options<U, UpdateOptions<T>>,
  ): Promise<Payload<T, U>>;

  delete(args: DeleteOptions<T>): Promise<ID>;

  count(): Promise<ID>;
  count(args: QueryOptions<T>): Promise<ID>;

  aggregate<U extends AggregateOptions<T>>(
    args: Options<U, AggregateOptions<T>>,
  ): Promise<AggregatePayload<T, U>[]>;

  updateAll(args: BulkUpdateOptions<T>): Promise<ID>;

  deleteAll(): Promise<ID>;
  deleteAll(args: BulkDeleteOptions<T>): Promise<ID>;
}
