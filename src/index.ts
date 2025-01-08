import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
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
  .onError(({ error, code }) => {
    if (code === "NOT_FOUND") return;
    console.error(error);
  })
  .use(video)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
