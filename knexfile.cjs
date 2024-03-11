// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  test: {
    client: "postgresql",
    searchPath: "public", // 1. add this
    connection: {
      database: "tinode_clone_test",
      user: "dbuser",
      password: "dbuser",
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      schemaName: "public", // 2. add this
      tableName: "knex_migrations",
    },
  },
  development: {
    client: "postgresql",
    connection: {
      database: "tinode_clone",
      user: "dbuser",
      password: "dbuser",
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  },

  staging: {
    client: "postgresql",
    connection: {
      database: "my_db",
      user: "username",
      password: "password",
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  },

  production: {
    client: "postgresql",
    connection: {
      database: "chatter",
      user: "postgres",
      password: "postgres",
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  },
};
