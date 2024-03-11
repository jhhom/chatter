module.exports = {
  apps: [
    {
      name: "chatter-next",
      cwd: "/home/server/chatter",
      script: "pnpm",
      args: "start-next",
      log_file:
        "/home/server/chatter/pm2-logs/next.log",
    },
    {
      name: "chatter-server",
      cwd: "/home/server/chatter",
      script: "pnpm",
      args: "start-server",
      log_file:
        "/home/server/chatter/pm2-logs/server.log",
    },
    {
      name: "chatter-asset",
      cwd: "/home/server/chatter",
      script: "pnpm",
      args: "start-asset",
      log_file:
        "/home/server/chatter/pm2-logs/asset-server.log",
    },
  ],
};
