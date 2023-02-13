import * as typeorm from "typeorm";
import { createDataSource } from "../typeorm/datasource";
import { EntityRepository } from "./client-repository";

import {
  ClientOptions,
  ConnectionClient,
  Entity,
  EntityClass,
  EntityClient,
  QueryClient,
  Repository,
} from "./types";

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
