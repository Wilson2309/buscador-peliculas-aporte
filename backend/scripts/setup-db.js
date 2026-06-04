import "dotenv/config";

import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const schemaPath = new URL("../src/database/schema.sql", import.meta.url);
const sql = await fs.readFile(schemaPath, "utf8");

const ssl =
  process.env.DB_SSL === "true"
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") } : {}),
      }
    : undefined;

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  ssl,
  multipleStatements: true,
});

await connection.query(sql);

await connection.changeUser({ database: process.env.DB_NAME || "cineflick" });

const [reviewColumns] = await connection.query(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'title'"
);
if (!reviewColumns.length) {
  await connection.query("ALTER TABLE reviews ADD COLUMN title VARCHAR(255) NULL AFTER tmdb_id");
}

await connection.query("ALTER TABLE ratings MODIFY COLUMN rating DECIMAL(3,1) NOT NULL");
await connection.end();

console.log("Base de datos CineFlick creada o actualizada correctamente.");
