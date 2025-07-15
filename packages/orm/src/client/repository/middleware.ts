import type { Middleware, MiddlewareArgs } from "../types";

export function intercept() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    descriptor.value = async function (...params: any[]) {
      const execute = target.intercept;
      const res = execute
        ? execute.call(this, propertyKey, params, () =>
            method.apply(this, params),
          )
        : method.apply(this, params);
      return res;
    };
    return descriptor;
  };
}

export class Interceptor {
  #middlewares: Middleware[] = [];

  push(...middleware: Middleware[]) {
    this.#middlewares.push(...middleware);
  }

  async execute<T>(args: MiddlewareArgs, cb: () => Promise<any>): Promise<any> {
    let stack: Middleware[] = [...this.#middlewares, cb];
    let index = -1;
    let next = async (): Promise<any> => {
      let func = stack[++index];
      if (func) {
        return await func(args, next);
      }
    };
    return await next();
  }
}