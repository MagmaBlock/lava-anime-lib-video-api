import cors from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { video } from "./video";

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "LavaAnimeLib VideoAPI",
          description: "A video API for LavaAnimeLib",
          version: "1.0.0",
        },
      },
    })
  )
  .use(cors())
  .use(video)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
