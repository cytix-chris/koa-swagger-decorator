import {
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { ZodTypeAny } from "zod";
import deepmerge from "deepmerge";
import { registry } from "./registry";
import { Container } from "./utils/container";
import {
  CONFIG_SYMBOL,
  DECORATOR_REQUEST,
  DECORATOR_SCHEMAS,
  getClassMetaKey,
} from "./utils/constant";
import {
  ClassRouteConfig,
  ResponseSchemaConfig,
  ResponsesDecoratorInput,
} from "./decorator";

type BodyDecoratorMeta = {
  schema: ZodTypeAny;
  contentType: string;
};

export interface PrepareDocsOptions {
  prefix?: string;
  spec?: Record<string, any>;
  openapi?: "3.0.0" | "3.1.0";
}

function isZodSchema(input: unknown): input is ZodTypeAny {
  return !!input && typeof (input as ZodTypeAny).safeParse === "function";
}

function normalizeRefStatusCode(statusCode: string) {
  return statusCode.replace(/[^a-zA-Z0-9]/g, "_");
}

function getClassRouteConfig(identifier: string): ClassRouteConfig {
  const className = identifier.split("-")[0];
  return (Container.get(getClassMetaKey(className)) as ClassRouteConfig) ?? {};
}

function joinPath(...paths: string[]) {
  const segments = paths
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/(^\/+|\/+?$)/g, ""));
  return `/${segments.join("/")}`.replace(/\/+/g, "/");
}

function getResponseDescription(statusCode: string) {
  if (statusCode.startsWith("2")) {
    return "success";
  }
  return `HTTP ${statusCode} response`;
}

function handleRouteConfig(routeConfig: RouteConfig, identifier: string) {
  const meta =
    (Container.get(`DECORATOR_MERGE_${identifier}`) as Partial<RouteConfig>) ??
    {};
  const classMeta = getClassRouteConfig(identifier);

  if (!meta.operationId) {
    meta.operationId = identifier;
  }

  const obj = {
    ...meta,
  };
  delete obj.path;
  delete obj.method;

  const mergedConfig = deepmerge(routeConfig, obj);

  if (classMeta.tags?.length) {
    const tags = [...classMeta.tags, ...(mergedConfig.tags ?? [])];
    mergedConfig.tags = [...new Set(tags)];
  }

  if (classMeta.security?.length) {
    mergedConfig.security = [
      ...classMeta.security,
      ...(mergedConfig.security ?? []),
    ];
  }

  return mergedConfig;
}

function handleSchemas(docRegistry: OpenAPIRegistry) {
  const meta = Container.get(DECORATOR_SCHEMAS);
  if (meta) {
    for (const o of meta) {
      docRegistry.register(o.refId, o.zodSchema);
    }
  }
}

function handleBody(
  routeConfig: RouteConfig,
  identifier: string,
  docRegistry: OpenAPIRegistry
) {
  const bodyMeta = Container.get(`DECORATOR_BODY_${identifier}`) as
    | BodyDecoratorMeta
    | undefined;

  if (!bodyMeta) {
    return;
  }

  docRegistry.register(`${identifier}BodyRequest`, bodyMeta.schema);

  routeConfig.request = {
    ...routeConfig.request,
    body: {
      content: {
        [bodyMeta.contentType]: {
          schema: {
            $ref: `#/components/schemas/${identifier}BodyRequest`,
          },
        },
      },
    },
  };
}

function toResponseConfig(
  statusCode: string,
  responseMeta: ResponseSchemaConfig,
  identifier: string,
  docRegistry: OpenAPIRegistry
) {
  let schema: ZodTypeAny;
  let contentType = "application/json";
  let description = getResponseDescription(statusCode);

  if (isZodSchema(responseMeta)) {
    schema = responseMeta;
  } else {
    schema = responseMeta.schema;
    contentType = responseMeta.contentType ?? contentType;
    description = responseMeta.description ?? description;
  }

  const suffix = statusCode === "200" ? "" : `_${normalizeRefStatusCode(statusCode)}`;
  const schemaRef = `${identifier}Response${suffix}`;

  docRegistry.register(schemaRef, schema);

  return {
    [statusCode]: {
      description,
      content: {
        [contentType]: {
          schema: {
            $ref: `#/components/schemas/${schemaRef}`,
          },
        },
      },
    },
  };
}

function handleResponse(
  routeConfig: RouteConfig,
  identifier: string,
  docRegistry: OpenAPIRegistry
) {
  const responsesMeta = Container.get(
    `DECORATOR_RESPONSES_${identifier}`
  ) as ResponsesDecoratorInput | undefined;

  if (!responsesMeta) {
    return;
  }

  const responsesConfig = isZodSchema(responsesMeta)
    ? toResponseConfig("200", responsesMeta, identifier, docRegistry)
    : Object.entries(responsesMeta).reduce(
        (acc, [statusCode, responseConfig]) => ({
          ...acc,
          ...toResponseConfig(
            statusCode,
            responseConfig,
            identifier,
            docRegistry
          ),
        }),
        {}
      );

  routeConfig.responses = {
    ...routeConfig.responses,
    ...responsesConfig,
  };
}

function resolvePrepareOptions(prefixOrOptions?: string | PrepareDocsOptions) {
  if (!prefixOrOptions) {
    return {} as PrepareDocsOptions;
  }

  if (typeof prefixOrOptions === "string") {
    return {
      prefix: prefixOrOptions,
    } as PrepareDocsOptions;
  }

  return prefixOrOptions;
}

export function prepareDocs(prefixOrOptions?: string | PrepareDocsOptions) {
  const options = resolvePrepareOptions(prefixOrOptions);
  const docRegistry = new OpenAPIRegistry([registry]);

  const apiList = Container.has(DECORATOR_REQUEST)
    ? Container.get(DECORATOR_REQUEST)
    : [];

  for (const { method, path, identifier } of apiList) {
    const classMeta = getClassRouteConfig(identifier);
    const routePath = joinPath(options.prefix ?? "", classMeta.path ?? "", path);

    const routeConfig: RouteConfig = {
      path: routePath,
      method,
      request: {},
      responses: {
        "200": {
          description: "success",
        },
      },
    };

    handleBody(routeConfig, identifier, docRegistry);
    handleResponse(routeConfig, identifier, docRegistry);
    handleSchemas(docRegistry);

    docRegistry.registerPath(handleRouteConfig(routeConfig, identifier));
  }

  const config = (Container.get(CONFIG_SYMBOL) ?? {}) as Record<string, any>;
  const spec = options.spec ?? config.spec ?? {};
  const openapi = options.openapi ?? config.openapi ?? "3.1.0";

  if (openapi === "3.0.0") {
    const generator = new OpenApiGeneratorV3(docRegistry.definitions);
    return generator.generateDocument({
      openapi,
      info: {
        version: "1.0",
        title: "Swagger OpenAPI",
      },
      ...spec,
    });
  }

  const generator = new OpenApiGeneratorV31(docRegistry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      version: "1.0",
      title: "Swagger OpenAPI",
    },
    ...spec,
  });
}

export function generateOpenAPIDocument(options?: PrepareDocsOptions) {
  return prepareDocs(options);
}
