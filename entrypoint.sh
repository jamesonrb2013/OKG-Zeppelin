#!/bin/sh
set -eu

export NODE_ENV=production

case "${1:-}" in
    migrate)
        exec pnpm run --silent run:migrate
        ;;
    bot)
        exec node -e '
            const http = require("http");
            const { spawn } = require("child_process");

            const required = {
                KEY: (value) => value.length === 32,
                CLIENT_ID: (value) => value.length >= 16,
                CLIENT_SECRET: (value) => value.length === 32,
                BOT_TOKEN: (value) => value.length >= 50,
                DASHBOARD_URL: (value) => /^https?:\\/\\//.test(value),
                API_URL: (value) => /^https?:\\/\\//.test(value),
                REDIS_URL: (value) => value.length > 0
            };

            const invalid = Object.entries(required)
                .filter(([key, validate]) => !process.env[key] || !validate(process.env[key]))
                .map(([key]) => key);

            if (invalid.length) {
                console.error("[OKG startup] Missing or invalid environment variables:", invalid.join(", "));
                process.exit(1);
            }

            const port = Number(process.env.PORT) || 10000;
            const server = http.createServer((_req, res) => {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("OK");
            });

            server.on("error", (error) => {
                console.error("[OKG startup] Health server failed:", error);
                process.exit(1);
            });

            server.listen(port, "0.0.0.0", () => {
                console.log("[OKG startup] Health server listening on 0.0.0.0:" + port);
            });

            console.log("[OKG startup] Launching bot from /zeppelin...");
            const bot = spawn("pnpm", ["run", "--silent", "run:bot"], {
                cwd: "/zeppelin",
                stdio: "inherit",
                env: process.env
            });

            bot.on("spawn", () => console.log("[OKG startup] Bot process spawned."));
            bot.on("error", (error) => {
                console.error("[OKG startup] Could not spawn pnpm:", error);
                server.close(() => process.exit(1));
            });
            bot.on("exit", (code, signal) => {
                console.error("[OKG startup] Bot process exited. code=" + code + " signal=" + signal);
                server.close(() => process.exit(code === null ? 1 : code));
            });

            let stopping = false;
            const shutdown = (signal) => {
                if (stopping) return;
                stopping = true;
                console.log("[OKG startup] Received " + signal + "; stopping bot...");
                if (bot.exitCode === null && bot.signalCode === null) bot.kill(signal);
                server.close();
            };
            process.on("SIGTERM", () => shutdown("SIGTERM"));
            process.on("SIGINT", () => shutdown("SIGINT"));
        '
        ;;
    api)
        exec pnpm run --silent run:api
        ;;
    dashboard)
        exec pnpm run --silent run:dashboard
        ;;
    *)
        echo "Unknown command: ${1:-<empty>}"
        exit 1
        ;;
esac
