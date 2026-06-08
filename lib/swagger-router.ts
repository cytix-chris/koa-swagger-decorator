import Router, { RouterOptions } from "@koa/router";
import { Container } from "./utils/container";
import {
  CONFIG_SYMBOL,
  convertPath,
  getClassMetaKey,
  reservedMethodNames,
} from "./utils/constant";
import is from "is-type-of";
import swaggerHTML from "./swagger-html";
import { prepareDocs } from "./swagger-builder";
import { registry } from "./registry";
import { OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { Context, Middleware } from "koa";
import { ZodTypeAny } from "zod";
import {
  ClassRouteConfig,
  ResponseSchemaConfig,
  ResponsesDecoratorInput,
} from "./decorator";

type BodySchemaMeta = {
  schema: ZodTypeAny;
  contentType: string;
};

function isZodSchema(input: unknown): input is ZodTypeAny {
  return !!input && typeof (input as ZodTypeAny).safeParse === "function";
}

function joinPath(...paths: string[]) {
  const segments = paths
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/(^\/+|\/+?$)/g, ""));
  return `/${segments.join("/")}`.replace(/\/+/g, "/");
}

function getStatusResponseSchema(
  statusCode: number,
  responsesMeta?: ResponsesDecoratorInput
) {
  if (!responsesMeta) {
    return;
  }

  if (isZodSchema(responsesMeta)) {
    return responsesMeta;
  }

  const response = responsesMeta[String(statusCode)] ?? responsesMeta.default;
  if (!response) {
    return;
  }

  return isZodSchema(response)
    ? response
    : (response as Exclude<ResponseSchemaConfig, ZodTypeAny>).schema;
}

export interface ItemMeta {
  bodySchema?: BodySchemaMeta;
  responsesSchema?: ResponsesDecoratorInput;
  routeConfig: RouteConfig;
  middlewares?: Middleware[];
}
export interface SwaggerRouterConfig {
  swaggerJsonEndpoint?: string;
  swaggerHtmlEndpoint?: string;
  validateResponse?: boolean;
  validateRequest?: boolean;
  prefix?: string;
  openapi?: "3.0.0" | "3.1.0";
  spec?: Record<string, any>;
}
class SwaggerRouter<StateT = any, CustomT = {}> extends Router<
  StateT,
  CustomT
> {
  config: SwaggerRouterConfig;
  registry: OpenAPIRegistry;
  constructor(config: SwaggerRouterConfig = {}, opts: RouterOptions = {}) {
    super(opts);
    config.swaggerJsonEndpoint = config.swaggerJsonEndpoint ?? "/swagger-json";
    config.swaggerHtmlEndpoint = config.swaggerHtmlEndpoint ?? "/swagger-html";
    config.openapi = config.openapi ?? "3.1.0";
    config.validateRequest = true;

    this.config = config;
    this.registry = registry;
    Container.set(CONFIG_SYMBOL, config);
  }
  swagger() {
    this.get(this.config.swaggerJsonEndpoint!, (ctx) => {
      ctx.body = prepareDocs({
        prefix: this.opts.prefix,
        spec: this.config.spec,
        openapi: this.config.openapi,
      });
    });

    this.get(this.config.swaggerHtmlEndpoint!, (ctx) => {
      const endpoint = this.opts.prefix
        ? `${this.opts.prefix}${this.config.swaggerJsonEndpoint}`
        : this.config.swaggerJsonEndpoint!;
      ctx.body = swaggerHTML(endpoint);
    });
  }

  applyRoute(SwaggerClass: any) {
    const SwaggerClassPrototype = SwaggerClass.prototype;
    const classRouteConfig =
      (Container.get(getClassMetaKey(SwaggerClass.name)) as ClassRouteConfig) ??
      {};

    const methods = Object.getOwnPropertyNames(SwaggerClassPrototype)
      .filter((method) => !reservedMethodNames.includes(method))
      .map((method) => {
        const wrapperMethod = async (ctx, ...args) => {
          const c = new SwaggerClass(ctx);
          await c[method](ctx, ...args);
        };
        // 添加了一层 wrapper 之后，需要把原函数的名称暴露出来 fnName
        // wrapperMethod 继承原函数的 descriptors
        const descriptors = Object.getOwnPropertyDescriptors(
          SwaggerClassPrototype[method]
        );
        Object.defineProperties(wrapperMethod, {
          fnName: {
            value: method,
            enumerable: true,
            writable: true,
            configurable: true,
          },
          ...descriptors,
        });
        return wrapperMethod;
      });
    ([...methods] as any)
      // filter methods withour @request decorator
      .filter((item: ItemMeta) => {
        const { routeConfig } = item;
        if (!routeConfig) {
          return false;
        }
        const { method, path } = routeConfig;
        if (!path && !method) {
          return false;
        }
        return true;
      })
      // add router
      .forEach((item: ItemMeta) => {
        const { routeConfig, bodySchema, responsesSchema } = item;
        let { middlewares = [] } = item;

        const mergedRouteConfig: RouteConfig = {
          ...routeConfig,
          path: joinPath(classRouteConfig.path ?? "", routeConfig.path),
          tags: [...new Set([...(classRouteConfig.tags ?? []), ...(routeConfig.tags ?? [])])],
          security: [
            ...(classRouteConfig.security ?? []),
            ...(routeConfig.security ?? []),
          ],
        };

        middlewares = [
          ...((classRouteConfig.middlewares ?? []) as Middleware[]),
          ...middlewares,
        ];

        const mergedItem: ItemMeta = {
          ...item,
          middlewares,
          routeConfig: mergedRouteConfig,
        };

        if (!is.array(middlewares)) {
          throw new Error("middlewares params must be an array or function");
        }
        middlewares.forEach((item: Function) => {
          if (!is.function(item)) {
            throw new Error("item in middlewares must be a function");
          }
        });

        const validationMid = async (ctx: Context, next: any) => {
          ctx._swagger_decorator_meta = mergedItem;
          ctx.parsed = {
            query: ctx.request.query,
            params: (ctx.request as any)?.params,
            body: ctx.request.body,
          };
          if (this.config.validateRequest) {
            if (mergedRouteConfig.request?.query) {
              ctx.parsed.query = mergedRouteConfig.request?.query.parse(
                ctx.request.query
              );
            }
            if (mergedRouteConfig.request?.params) {
              ctx.parsed.params = mergedRouteConfig.request?.params.parse(
                (ctx.request as any).params
              );
            }
            if (bodySchema) {
              ctx.parsed.body = bodySchema.schema.parse(ctx.request.body);
            }
          }

          await next();

          if (this.config.validateResponse) {
            const responseSchema = getStatusResponseSchema(
              ctx.status || 200,
              responsesSchema
            );

            if (responseSchema) {
              responseSchema.parse(ctx.body);
            }
          }
        };

        const chain: [any] = [`${convertPath(`${mergedRouteConfig.path}`)}`];
        chain.push(validationMid);
        chain.push(...middlewares);
        chain.push((ctx) => (item as any)(ctx, ctx.parsed));
        this[mergedRouteConfig.method](...chain);
      });
    return this;
  }
}

export { SwaggerRouter };
