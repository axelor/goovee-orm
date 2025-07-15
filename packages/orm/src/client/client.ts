import * as typeorm from "typeorm";
import { createDataSource } from "../typeorm/datasource";
import { EntityRepository, Interceptor } from "./client-repository";

import { EntityOptions } from "../schema";
import {
  ClientFeatures,
  ClientOptions,
  ConnectionClient,
  Entity,
  EntityClass,
  EntityClient,
  Middleware,
  QueryClient,
  Repository,
} from "./types";

const createClientProxy = <T extends QueryClient>(
  client: T,
  interceptor: Interceptor,
  em: typeorm.EntityManager,
  entities: Record<string, EntityClass>,
  schema: EntityOptions[],
  features?: ClientFeatures,
) => {
  const repos: Record<string, Repository<any>> = {};
  const proxy = new Proxy(client, {
    get(target, p, receiver) {
      if (typeof p === "string" && p in entities) {
        const repo =
          repos[p] ??
          (repos[p] = new EntityRepository<any>(
            em.getRepository(entities[p]),
            proxy,
            interceptor,
          ));
        return repo;
      }

      if (typeof p === "string" && p === "__schema") return schema;
      if (typeof p === "string" && p === "__features") return features;

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
  T extends Record<string, EntityClass<E>>,
>(
  options: ClientOptions,
  entities: T,
  schema: EntityOptions[],
): ConnectionClient<EntityClient<T>> => {
  const { url, sync: synchronize, features } = options;
  const ds = createDataSource({
    type: "postgres",
    url,
    synchronize,
    entities: Object.values(entities),
  });

  const interceptor = new Interceptor();
  const conn = new Connection(ds, interceptor, (em) => {
    const client = new Client(em);
    const proxy = createClientProxy(
      client,
      interceptor,
      em,
      entities,
      schema,
      features,
    );
    return proxy;
  });

  return createClientProxy(
    conn,
    interceptor,
    ds.manager,
    entities,
    schema,
    features,
  ) as any;
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
  #interceptor;
  #factory;
  constructor(
    dataSource: typeorm.DataSource,
    interceptor: Interceptor,
    factory: ClientFactory,
  ) {
    super(dataSource.manager);
    this.#dataSource = dataSource;
    this.#interceptor = interceptor;
    this.#factory = factory;
  }

  get $connected() {
    return this.#dataSource.isInitialized;
  }

  $use(middleware: Middleware): ConnectionClient<Client> {
    this.#interceptor.push(middleware);
    return this;
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
