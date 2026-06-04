import { query } from "../config/db.js";

const publicFields = "id, nombre, email, avatar_url, bio, created_at, updated_at";

export const findUserByEmail = async (email) => {
  const rows = await query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
};

export const findUserById = async (id) => {
  const rows = await query(`SELECT ${publicFields} FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
};

export const createUser = async ({ nombre, email, passwordHash }) => {
  const result = await query("INSERT INTO users (nombre, email, password_hash) VALUES (?, ?, ?)", [
    nombre,
    email,
    passwordHash,
  ]);
  return findUserById(result.insertId);
};

export const updateUserProfile = async (id, { nombre, avatar_url, bio }) => {
  await query("UPDATE users SET nombre = ?, avatar_url = ?, bio = ? WHERE id = ?", [
    nombre,
    avatar_url || null,
    bio || null,
    id,
  ]);
  return findUserById(id);
};
