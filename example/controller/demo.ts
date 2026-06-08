import { ItemMeta, z } from "../../lib/index";
import {
  classRouteConfig,
  middlewares,
  responses,
  routeConfig,
} from "../../lib/decorator";
import { Context } from "koa";
import { AUTH_KEY } from "../schemas/extra";

@classRouteConfig({
  path: "/v1",
  tags: ["DEMO"],
})
export class DemoController {
  @routeConfig({
    path: "/demo",
    method: "get",
    security: [{ [AUTH_KEY]: [] }],
    request: {
      query: z.object({
        xxx: z.string().nullable().openapi({
          example: "110",
        }),
      }),
    },
  })
  @middlewares([
    async (ctx, next) => {
      const x = ctx._swagger_decorator_meta as ItemMeta; // get swagger decorator meta info through ctx
      console.log("biz mid", x.routeConfig);
      await next();
    },
  ])
  @responses(
    z.object({
      msg: z.string().openapi({ example: "gg" }),
    })
  )
  async getDemo(ctx: Context) {
    ctx.body = { random: "ggg", ...ctx.request.query };
  }
}
