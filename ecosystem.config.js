module.exports = {
  apps: [
    {
      name: "chatter-next",
      cwd: "/Users/joohom/SideProjects/tinode/tinode-next-2",
      script: "pnpm",
      args: "dev",
      log_file:
        "/Users/joohom/SideProjects/tinode/tinode-next-2/pm2-logs/next.log",
    },
    {
      name: "chatter-server",
      cwd: "/Users/joohom/SideProjects/tinode/tinode-next-2",
      script: "pnpm",
      args: "dev:server",
      log_file:
        "/Users/joohom/SideProjects/tinode/tinode-next-2/pm2-logs/server.log",
    },
    {
      name: "chatter-asset",
      cwd: "/Users/joohom/SideProjects/tinode/tinode-next-2",
      script: "pnpm",
      args: "dev:asset",
      log_file:
        "/Users/joohom/SideProjects/tinode/tinode-next-2/pm2-logs/asset-server.log",
    },
  ],
};
