import { Elysia, t } from "elysia";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { hash } from "ohash";

// 设置 ffmpeg 和 ffprobe 的路径
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH ?? "ffprobe");
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH ?? "ffmpeg");

export const video = new Elysia({ prefix: "/video" })
  .post(
    "/info",
    async ({ body, error }) => {
      try {
        return await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(body.url, (err, metadata) => {
            if (err) reject(err);

            // 直接返回完整的ffprobe元数据
            resolve(metadata);
          });
        });
      } catch (err) {
        return error(500, err);
      }
    },
    {
      body: t.Object({
        url: t.String({
          description: "视频地址，需要是 FFmpeg 能够支持打开的 URL",
          examples: [
            "https://mirror.clarkson.edu/blender/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4",
          ],
        }),
      }),
    }
  )
  .post(
    "/screenshot",
    async ({ body, set, error }) => {
      try {
        // 使用ohash生成唯一文件名
        const filename = `temp_screenshot_${hash(body)}.webp`;

        await new Promise((resolve, reject) => {
          ffmpeg(body.url)
            .on("error", (err) => reject(err))
            .outputOptions([
              "-f",
              "image2",
              "-vcodec",
              "libwebp",
              "-frames:v",
              "1",
              "-quality",
              "80",
            ])
            .size(body.height ? `?x${body.height}` : "0x0") // 保持宽高比，未指定时使用原始分辨率
            .seekInput(body.seconds)
            .outputFormat("webp")
            .save(filename)
            .on("end", () => {
              resolve(null);
            });
        });

        // 将图片读取到内存并删除临时文件
        const image = fs.readFileSync(filename);
        fs.unlinkSync(filename);
        // 设置响应头
        set.headers["content-type"] = "image/webp";
        // 发送图片二进制流
        return image;
      } catch (err) {
        return error(500, err);
      }
    },
    {
      body: t.Object({
        url: t.String({
          description: "视频地址，需要是 FFmpeg 能够支持打开的 URL",
          examples: [
            "https://mirror.clarkson.edu/blender/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4",
          ],
        }),
        seconds: t.Number({
          minimum: 0,
          description: `从视频的哪一秒截取画面。本参数仅为近似值，ffmpeg 将取最近的关键帧`,
          examples: [30],
        }),
        height: t.Optional(
          t.Number({
            description: "截图高度，保持原比例。不指定则使用视频原始分辨率",
            minimum: 1,
            examples: [480, 720, 1080],
          })
        ),
      }),
    }
  )
  .post(
    "/subtitles",
    async ({ body, error }) => {
      try {
        return await new Promise((resolve, reject) => {
          // 获取视频流信息
          ffmpeg.ffprobe(body.url, (err, metadata) => {
            if (err) return reject(err);

            // 过滤出字幕流
            const subtitleStreams = metadata.streams.filter(
              (stream) => stream.codec_type === "subtitle"
            );

            // 创建临时目录
            const tempDir = `temp_subtitles_${Date.now()}`;
            fs.mkdirSync(tempDir);

            // 使用单个 ffmpeg 进程提取所有字幕
            new Promise((resolve, reject) => {
              const command = ffmpeg(body.url);

              // 为每个字幕流添加输出选项
              subtitleStreams.forEach((stream, index) => {
                const outputFile = `${tempDir}/subtitle_${index}.${stream.codec_name}`;
                command.output(outputFile).outputOptions([
                  "-map",
                  `0:${stream.index}`,
                  "-avoid_negative_ts",
                  "make_zero", // 防止时间戳问题
                ]);
              });

              command.on("end", resolve).on("error", reject).run();
            })
              .then(() => {
                // 读取所有字幕文件
                const subtitles = subtitleStreams.map((stream, index) => {
                  const tempFile = `${tempDir}/subtitle_${index}.${stream.codec_name}`;
                  const content = fs.readFileSync(tempFile, "utf-8");
                  fs.unlinkSync(tempFile); // 删除临时文件

                  return {
                    index: stream.index,
                    codec_name: stream.codec_name,
                    language: stream.tags?.language || "unknown",
                    title: stream.tags?.title || "Untitled",
                    content: content,
                  };
                });

                // 删除临时目录
                fs.rmdirSync(tempDir);
                resolve(subtitles);
              })
              .catch(reject);
          });
        });
      } catch (err) {
        return error(500, err);
      }
    },
    {
      body: t.Object({
        url: t.String({
          description: "视频地址，需要是 FFmpeg 能够支持打开的 URL",
          examples: [
            "https://mirror.clarkson.edu/blender/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4",
          ],
        }),
      }),
    }
  );
