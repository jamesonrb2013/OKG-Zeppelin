#!/bin/sh

export NODE_ENV=production

case "$1" in
    migrate) exec pnpm run --silent run:migrate;;
    bot)
        node -e 'require("http").createServer((req,res)=>res.end("OK")).listen(process.env.PORT||10000,"0.0.0.0")' &
        exec pnpm run --silent run:bot
        ;;
    api) exec pnpm run --silent run:api;;
    dashboard) exec pnpm run --silent run:dashboard;;
    *)
        echo "Unknown command: $1"
        exit 1
        ;;
esac
