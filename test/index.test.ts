import { test, expect, describe } from "bun:test";
import swaggerHTML from "../lib/swagger-html";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  body,
  classRouteConfig,
  formData,
  responses,
  routeConfig,
} from "../lib";
import { prepareDocs, generateOpenAPIDocument } from "../lib/swagger-builder";
import { ParameterObject } from "openapi-client-axios";

describe("swagger-html", () => {
  test("# using custom swagger ui", () => {
    const res = swaggerHTML("", {
      "swagger-ui-bundle": "my_custom/swagger-ui-bundle.js",
      "swagger-ui-css": "my_custom/swagger-ui.css",
    });
    expect(res).toInclude('src="my_custom/swagger-ui');
  });
});

describe("swagger-builder", () => {
  test("#@routeConfig", () => {
    const c: Partial<RouteConfig> = {
      path: "/demo",
      method: "get",
      tags: ["DEMO"],
      request: {
        query: z.object({
          xxx: z.string().nullable().openapi({
            example: "110",
          }),
        }),
      },
    };
    routeConfig(c)({}, "testFn", {
      value: {},
    });
    const ret = prepareDocs("");
    expect(
      (ret.paths!["/demo"].get?.parameters![0] as ParameterObject).name
    ).toBe("xxx");
    expect((ret.paths!["/demo"].get?.parameters![0] as ParameterObject).in).toBe(
      "query"
    );
  });

  test("#@body", () => {
    const c: Partial<RouteConfig> = {
      path: "/demo_body",
      method: "post",
      tags: ["DEMO"],
      request: {},
    };
    routeConfig(c)({}, "testBodyFn", {
      value: {},
    });
    body(
      z.object({
        a: z.string(),
      })
    )({}, "testBodyFn", { value: {} });
    const ret = prepareDocs("");
    expect(
      (ret.paths!["/demo_body"].post?.requestBody! as any).content[
        "application/json"
      ].schema.$ref
    ).toBe("#/components/schemas/Object-testBodyFnBodyRequest");
  });

  test("#supports multipart form-data", () => {
    const c: Partial<RouteConfig> = {
      path: "/demo_form_data",
      method: "post",
      tags: ["DEMO"],
      request: {},
    };
    routeConfig(c)({}, "testFormData", {
      value: {},
    });

    formData(
      z.object({
        file: z.string(),
      })
    )({}, "testFormData", { value: {} });

    const ret = prepareDocs();
    expect(
      (ret.paths!["/demo_form_data"].post?.requestBody as any).content[
        "multipart/form-data"
      ].schema.$ref
    ).toBe("#/components/schemas/Object-testFormDataBodyRequest");
  });

  test("#supports non-200 responses", () => {
    const c: Partial<RouteConfig> = {
      path: "/demo_non_200",
      method: "post",
      tags: ["DEMO"],
      request: {},
    };
    routeConfig(c)({}, "testNon200", {
      value: {},
    });

    responses({
      "201": z.object({
        id: z.string(),
      }),
      "400": {
        schema: z.object({
          message: z.string(),
        }),
        description: "bad request",
      },
    })({}, "testNon200", { value: {} });

    const ret = prepareDocs();
    const postResponse = ret.paths!["/demo_non_200"].post!.responses!;

    expect(
      (postResponse["201"] as any).content[
        "application/json"
      ].schema.$ref
    ).toBe("#/components/schemas/Object-testNon200Response_201");

    expect(postResponse["400"]?.description).toBe(
      "bad request"
    );
  });

  test("#supports class decorators and offline generation", () => {
    class DummyController {}

    classRouteConfig({
      path: "/v1",
      tags: ["DUMMY"],
    })(DummyController);

    routeConfig({
      path: "/offline-doc",
      method: "get",
      request: {},
    })(DummyController.prototype, "OfflineDoc", {
      value: {},
    });

    responses(
      z.object({
        ok: z.boolean(),
      })
    )(DummyController.prototype, "OfflineDoc", { value: {} });

    const ret = generateOpenAPIDocument({
      openapi: "3.1.0",
      spec: {
        info: {
          title: "Offline Schema",
          version: "1.0.0",
        },
      },
    });

    expect(ret.openapi).toBe("3.1.0");
    expect(ret.paths!["/v1/offline-doc"].get?.tags).toEqual(["DUMMY"]);
    expect(ret.info.title).toBe("Offline Schema");
  });
});
