import { pgQuery, pgMigrate } from "./pg.js";

export function usingPostgres() {
  return Boolean(process.env.DATABASE_URL);
}

// Interface única SaaS v2 (Postgres only)
export const dbi = {
  // Mantemos migrate compatível com o boot antigo
  async migrate() {
    if (!usingPostgres()) {
      console.warn("⚠️ DATABASE_URL não definido. SaaS v2 exige Postgres.");
      return;
    }
    return pgMigrate();
  },

  async query(sql, params = []) {
    if (!usingPostgres()) {
      throw new Error("DATABASE_URL ausente. Postgres é obrigatório no SaaS v2.");
    }

    const res = await pgQuery(sql, params);
    return { rows: res.rows };
  }
};