import path from "node:path";
import swaggerJSDoc, { type Options } from "swagger-jsdoc";

const swaggerOptions: Options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Lattice API",
      version: "1.0.0",
      description: "Privacy-respecting group scheduling endpoints powering the Lattice web client.",
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL ?? "/",
      },
    ],
  },
  apis: [
    path.resolve(process.cwd(), "src/app/api/**/*.ts"),
    path.resolve(process.cwd(), "src/app/api/**/*.tsx"),
  ],
};

let cachedSpec: ReturnType<typeof swaggerJSDoc> | null = null;

export function getOpenApiSpec() {
  if (!cachedSpec || process.env.NODE_ENV === "development") {
    cachedSpec = swaggerJSDoc(swaggerOptions);
  }
  return cachedSpec;
}
