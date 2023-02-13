import * as typeorm from "typeorm";
import { createDataSource } from "../typeorm/datasource";
import * as handler from "./handler";

import {
  BulkDeleteOptions,
  BulkUpdateOptions,
  CreateOptions,
  DeleteOptions,
  Entity,
  ID,
  Options,
  Payload,
  QueryOptions,
  Repository,
  UpdateOptions,
} from "./types";

export type QueryClient = {
  $raw(query: string, ...params: any[]): Promise<unknown>;
};

export type ConnectionClient<T extends QueryClient> = T & {
  $sync(): Promise<void>;
  $sync(drop: boolean): Promise<void>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<R>(job: (client: T) => Promise<R>): Promise<R>;
};

export type EntityClass<T extends Entity = Entity> = new () => T;
export type EntityClient<T extends Record<string, EntityClass>> =
  QueryClient & {
    [K in keyof T]: T[K] extends EntityClass<infer E> ? Repository<E> : never;
  };

export type ClientOptions = {
  url: string;
  sync?: boolean;
};

const createClientProxy = <T extends object>(
  target: T,
  em: typeorm.EntityManager,
  entities: Record<string, EntityClass>
) => {
  const repos: Record<string, Repository<any>> = {};
  const proxy = new Proxy(target, {
    get(target, p, receiver) {
      if (typeof p === "string" && p in entities) {
        const repo =
          repos[p] ??
          (repos[p] = new EntityRepository<any>(em.getRepository(entities[p])));
        return repo;
      }
      const value = Reflect.get(target, p);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(target, p) {
      return p in entities || Reflect.has(target, p);
    },
    ownKeys(target) {
      return [...Reflect.ownKeys(target), ...Object.keys(entities)];
    },
  });
  return proxy;
};

export const createClient = <
  E extends Entity,
  T extends Record<string, EntityClass<E>>
>(
  options: ClientOptions,
  entities: T
): ConnectionClient<EntityClient<T>> => {
  const { url, sync: synchronize } = options;
  const ds = createDataSource({
    type: "postgres",
    url,
    synchronize,
    entities: Object.values(entities),
  });

  const conn = new Connection(ds, (em) => {
    const client = new Client(em);
    const proxy = createClientProxy(client, em, entities);
    return proxy;
  });

  return createClientProxy(conn, ds.manager, entities) as any;
};

type ClientFactory = (em: typeorm.EntityManager) => Client;

class Client implements QueryClient {
  #manager;

  constructor(manager: typeorm.EntityManager) {
    this.#manager = manager;
  }

  async $raw(query: string, ...params: any[]): Promise<unknown> {
    return await this.#manager.query(query, params);
  }
}

class Connection extends Client implements ConnectionClient<Client> {
  #dataSource;
  #factory;
  constructor(dataSource: typeorm.DataSource, factory: ClientFactory) {
    super(dataSource.manager);
    this.#dataSource = dataSource;
    this.#factory = factory;
  }

  async $sync(drop?: boolean): Promise<void> {
    return await this.#dataSource.synchronize(drop);
  }

  async $connect(): Promise<void> {
    await this.#dataSource.initialize();
  }

  async $disconnect(): Promise<void> {
    await this.#dataSource.destroy();
  }

  async $transaction<R>(job: (client: Client) => Promise<R>): Promise<R> {
    return await this.#dataSource.transaction(async (em) => {
      const client = this.#factory(em);
      return job(client);
    });
  }
}

class EntityRepository<T extends Entity> implements Repository<T> {
  #repo: typeorm.Repository<T>;

  constructor(repo: typeorm.Repository<T>) {
    this.#repo = repo;
  }

  unwrap() {
    return this.#repo;
  }

  async find<U extends QueryOptions<T>>(
    args?: Options<U, QueryOptions<T>>
  ): Promise<Payload<T, U>[]> {
    return await handler.handleFindMany(this.#repo, args ?? {});
  }

  async findOne<U extends QueryOptions<T>>(
    args?: Options<U, QueryOptions<T>>
  ): Promise<Payload<T, U> | null> {
    return await handler.handleFindOne(this.#repo, args ?? {});
  }

  async count(args?: QueryOptions<T>) {
    return await handler.handleCount(this.#repo, args ?? {});
  }

  async create<U extends CreateOptions<T>>(
    args: Options<U, CreateOptions<T>>
  ): Promise<Payload<T, U>> {
    const { data, select } = args;
    const { id } = await handler.handleCreate(this.#repo, data);
    const found = await this.findOne({ select, where: { id } });
    return found as unknown as Payload<T, U>;
  }

  async update<U extends UpdateOptions<T>>(
    args: Options<U, UpdateOptions<T>>
  ): Promise<Payload<T, U>> {
    const { data, select } = args;
    const { id } = await handler.handleUpdate(this.#repo, data);
    const found = await this.findOne({ select, where: { id } });
    return found as unknown as Payload<T, U>;
  }

  async delete(args: DeleteOptions<T>): Promise<ID> {
    return await handler.handleDelete(this.#repo, args);
  }

  async updateAll(args: BulkUpdateOptions<T>): Promise<ID> {
    return await handler.handleBulkUpdate(this.#repo, args);
  }

  async deleteAll(args?: BulkDeleteOptions<T>): Promise<ID> {
    return await handler.handleBulkDelete(this.#repo, args ?? {});
  }
}
