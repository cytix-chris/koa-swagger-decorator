import { ZodTypeAny } from "zod";
import { Container } from "./utils/container";
import {
  DECORATOR_REQUEST,
  getClassMetaKey,
  getIdentifier,
} from "./utils/constant";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";

export type DecoratorBodyOptions = {
  contentType?: string;
};

export type ResponseSchemaConfig =
  | ZodTypeAny
  | {
      schema: ZodTypeAny;
      description?: string;
      contentType?: string;
    };

export type ResponsesDecoratorInput =
  | ZodTypeAny
  | Record<string, ResponseSchemaConfig>;

export interface ClassRouteConfig {
  path?: string;
  tags?: string[];
  security?: RouteConfig["security"];
  middlewares?: Function[];
}

const body =
  (v: ZodTypeAny, options: DecoratorBodyOptions = {}) =>
  (target: any, name: string, descriptor: PropertyDescriptor) => {
    const bodyMeta = {
      schema: v,
      contentType: options.contentType ?? "application/json",
    };
    descriptor.value.bodySchema = bodyMeta;
    Container.set(`DECORATOR_BODY_${getIdentifier(target, name)}`, bodyMeta);
    return descriptor;
  };

const formData =
  (v: ZodTypeAny) =>
  (target: any, name: string, descriptor: PropertyDescriptor) => {
    return body(v, { contentType: "multipart/form-data" })(
      target,
      name,
      descriptor
    );
  };

const responses =
  (v: ResponsesDecoratorInput) =>
  (target: any, name: string, descriptor: PropertyDescriptor) => {
    descriptor.value.responsesSchema = v;
    Container.set(`DECORATOR_RESPONSES_${getIdentifier(target, name)}`, v);
    return descriptor;
  };

const middlewares =
  (middlewares: Function[]) =>
  (target: any, name: string, descriptor: PropertyDescriptor) => {
    Container.set(
      `DECORATOR_MIDDLEWARES_${getIdentifier(target, name)}`,
      middlewares
    );
    descriptor.value.middlewares = middlewares;
    return descriptor;
  };

const routeConfig =
  (v: Partial<RouteConfig>) =>
  (target: any, methodName: string, descriptor: PropertyDescriptor) => {
    if (!v.method || !v.path) {
      throw new Error(`missing [method] and [path] fields for routeConfig`);
    }
    const className = target.constructor.name;
    const identifier = `${className}-${methodName}`;
    Container.set(`DECORATOR_MERGE_${identifier}`, v);
    const { method, path } = v;
    descriptor.value.routeConfig = v;
    const apiList = Container.get(DECORATOR_REQUEST);
    if (!apiList) {
      Container.set(DECORATOR_REQUEST, [
        { method, path, identifier, methodName, className },
      ]);
    } else {
      apiList.push({ method, path, identifier, methodName, className });
      Container.set(DECORATOR_REQUEST, apiList);
    }

    return descriptor;
  };

const classRouteConfig =
  (v: ClassRouteConfig) =>
  (target: any) => {
    const className = target.name;
    Container.set(getClassMetaKey(className), v);
    return target;
  };

export {
  body,
  classRouteConfig,
  formData,
  responses,
  routeConfig,
  middlewares,
};
