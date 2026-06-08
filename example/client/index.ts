import OpenAPIClientAxios from "openapi-client-axios";
import { Client } from "./openapi";
import common from "../config";
const api = new OpenAPIClientAxios({
  definition: `${common.baseUrl}/api/swagger-json`,
  axiosConfigDefaults: {
    baseURL: common.baseUrl,
  },
});
api.init();
async function createPet() {
  const client = await api.getClient<Client>();
  const ret = await client.CreateUser(
    null,
    { age: 18, uid: "aa" },
    {
      headers: { Authorization: "aa" },
    }
  );
  console.log("status", ret.status, "response", ret.data);
}

async function uploadAvatar() {
  const client = await api.getClient<Client>();
  const ret = await client.UploadUserAvatar(null, {
    uid: "aa",
    fileName: "avatar.png",
  });
  console.log("upload", ret.status, ret.data);
}

createPet().then(uploadAvatar);
