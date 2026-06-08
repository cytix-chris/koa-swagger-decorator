import { Context } from "koa";
import {
  body,
  classRouteConfig,
  formData,
  middlewares,
  responses,
  routeConfig,
} from "../../lib/decorator";
import {
  CreateUserReq,
  CreateUserRes,
  ErrorResponse,
  ICreateAvatarRes,
  GetUserByIdResponse,
  ICreateUserRes,
  IGetUserByIdResponse,
  IListUserReq,
  IListUserRes,
  ListUserResponse,
  ListUsersRequest,
  UploadAvatarReq,
  UploadAvatarRes,
  UpdateUserReq,
  UpdateUserRes,
} from "../schemas/user";
import { ParsedArgs, z } from "../../lib/index";
import { AUTH_KEY } from "../schemas/extra";

@classRouteConfig({
  path: "/v1",
  tags: ["USER"],
})
class UserController {
  @routeConfig({
    method: "get",
    path: "/user/{uid}",
    summary: "get user by id",
    description: "detailed user",
    tags: ["USER"],
    operationId: "GetUserById",
    request: {
      params: z.object({
        uid: z.string().nonempty(),
      }),
    },
  })
  @responses(GetUserByIdResponse)
  async GetUserById(ctx: Context) {
    console.log((ctx.request as any).params);
    ctx.body = {
      user: {
        id: (ctx.request as any).params.id,
        uid: "111",
        name: "ggggg",
      },
      message: "ok",
    } as IGetUserByIdResponse;
  }

  @routeConfig({
    method: "get",
    path: "/users",
    summary: "获取用户列表",
    description: "merge description",
    tags: ["USER", "HAHAHA"],
    operationId: "ListUsers",
    request: {
      query: ListUsersRequest,
    },
  })
  @responses(ListUserResponse)
  async ListUsers(ctx: Context, args: ParsedArgs<IListUserReq>) {
    console.log(ctx.request.query, ctx.parsed.query);
    ctx.body = { users: [], args } as IListUserRes;
  }

  @routeConfig({
    method: "post",
    path: "/users",
    summary: "创建用户",
    security: [{ [AUTH_KEY]: [] }],
    operationId: "CreateUser",
  })
  @middlewares([
    async (ctx: Context, next) => {
      console.log("CreateUser Middleware Test", ctx.headers.authorization);
      if (!ctx.headers.authorization) {
        throw new Error("request forbidden");
      }
      await next();
    },
  ])
  @body(CreateUserReq)
  @responses({
    "201": {
      schema: CreateUserRes,
      description: "created",
    },
    "400": {
      schema: ErrorResponse,
      description: "invalid request",
    },
  })
  async CreateUser(ctx: Context) {
    console.log(ctx.request.body);
    ctx.status = 201;
    ctx.body = { message: "create", id: "123" } as ICreateUserRes;
  }

  @routeConfig({
    path: "/users/update",
    method: "put",
    tags: ["USER"],
  })
  @body(UpdateUserReq)
  @responses(UpdateUserRes)
  async UpdateUser(ctx: Context) {
    console.log(ctx.request.body);
    type IUpdateUserRes = z.infer<typeof UpdateUserRes>;
    ctx.body = { message: "updated", id: "123" } as IUpdateUserRes;
  }

  @routeConfig({
    path: "/users/avatar",
    method: "post",
    operationId: "UploadUserAvatar",
  })
  @formData(UploadAvatarReq)
  @responses({
    "200": UploadAvatarRes,
    "400": {
      schema: ErrorResponse,
      description: "invalid form data",
    },
  })
  async UploadUserAvatar(ctx: Context) {
    const body = ctx.request.body as Record<string, string>;
    if (!body?.uid || !body?.fileName) {
      ctx.status = 400;
      ctx.body = {
        message: "uid and fileName are required",
      };
      return;
    }

    ctx.body = {
      uid: body.uid,
      uploaded: true,
      url: `https://cdn.example.com/avatar/${body.uid}/${body.fileName}`,
    } as ICreateAvatarRes;
  }
}

export { UserController };
