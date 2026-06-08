import { z } from "../../lib";

const UserStruct = z.object({
  id: z.string().nullable(),
  uid: z.string().nonempty(),
  name: z.string().nullable(),
  age: z.number().min(18).nullable(),
  randomKey: z.string().nullable(),
});

const GetUserByIdRequest = z.object({
  uid: z.string().nullable(),
});

const GetUserByIdResponse = z.object({
  user: UserStruct,
  message: z.string().nullable(),
});

const ListUsersRequest = z.object({
  count: z.coerce.number().default(10),
  limit: z.coerce.number().default(0),
});

const ListUserResponse = z.object({
  users: z.array(UserStruct),
});

const CreateUserReq = z.object({
  uid: z.string().nonempty(),
  name: z.string().nullable().optional(),
  age: z.number().min(18).nullable(),
  operator: z.string().nonempty().optional(),
});

const CreateUserRes = z.object({
  id: z.string().nullable(),
  message: z.string().nullable(),
});

const ErrorResponse = z.object({
  message: z.string(),
});

const UpdateUserReq = z.object({
  id: z.string().nonempty(),
  name: z.string().nullable(),
  operator: z.string().nonempty(),
});

const UpdateUserRes = z.object({
  id: z.string().nullable(),
  message: z.string().nullable(),
});

const UploadAvatarReq = z.object({
  uid: z.string().nonempty(),
  fileName: z.string().nonempty(),
});

const UploadAvatarRes = z.object({
  uid: z.string().nonempty(),
  uploaded: z.boolean(),
  url: z.string().url(),
});

export {
  UserStruct,
  GetUserByIdRequest,
  GetUserByIdResponse,
  CreateUserReq,
  UpdateUserReq,
  CreateUserRes,
  ErrorResponse,
  UpdateUserRes,
  ListUserResponse,
  ListUsersRequest,
  UploadAvatarReq,
  UploadAvatarRes,
};

export type IGetUserByIdResponse = z.infer<typeof GetUserByIdResponse>;
export type ICreateUserRes = z.infer<typeof CreateUserRes>;
export type ICreateUserReq = z.infer<typeof CreateUserReq>;
export type IListUserRes = z.infer<typeof ListUserResponse>;
export type IListUserReq = z.infer<typeof ListUsersRequest>;
export type ICreateAvatarRes = z.infer<typeof UploadAvatarRes>;
