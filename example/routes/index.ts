import { generateOpenAPIDocument, SwaggerRouter } from "../../lib";
import { DemoController } from "../controller/demo";
import { UserController } from "../controller/user";
import { registerExtraComponents } from "../schemas/extra";

const router = new SwaggerRouter({
  openapi: "3.1.0",
  spec: {
    info: {
      title: "Example API Server",
      version: "v1.0",
    },
  },
});

router.prefix("/api");

registerExtraComponents(router.registry);

// apply swagger docs routes
router.swagger();

// apply user defined routes
router.applyRoute(UserController).applyRoute(DemoController);

// This can be used in scripts/CI without running the app server.
const offlineDoc = generateOpenAPIDocument({
  openapi: "3.1.0",
  prefix: "/api",
  spec: {
    info: {
      title: "Example API Server",
      version: "v1.0",
    },
  },
});

console.log("Offline OpenAPI version:", offlineDoc.openapi);

export { router };
