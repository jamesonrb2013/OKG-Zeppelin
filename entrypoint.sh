#!/bin/sh

export NODE_ENV=production

case "$1" in
    migrate) exec pnpm run --silent run:migrate;;
    bot)
    exec node -e '
      const http = require("http");
      const { spawn } = require("child_process");
      const port = Number(process.env.PORT) || 10000;

      const server = http.createServer((req, res) => {
        res.writeHead(200, {"Content-Type":"text/plain"});
        res.end("OK");
      });

      server.listen(port, "0.0.0.0", () =>
        console.log(`Health server listening on port ${port}`)
      );

      const bot = spawn("pnpm", ["run", "--silent", "run:bot"], {
        stdio: "inherit",
        env: process.env
      });

      const shutdown = (signal) => {
        bot.kill(signal);
        server.close();
      };

      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));

      bot.on("exit", (code, signal) => {
        server.close();
        process.exit(code ?? (signal ? 1 : 0));
      });
    '
    ;;
    api) exec pnpm run --silent run:api;;
    dashboard) exec pnpm run --silent run:dashboard;;
    *)
        echo "Unknown command: $1"
        exit 1
        ;;
esac
