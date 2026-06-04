import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { createHttpError, asyncHandler } from "../middleware/errorHandler.js";
import { createUser, findUserByEmail, findUserById } from "../models/user.model.js";

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const requireJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw createHttpError(500, "JWT_SECRET no esta configurado");
};

export const register = asyncHandler(async (req, res) => {
  requireJwtSecret();
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    throw createHttpError(400, "nombre, email y password son obligatorios");
  }
  if (String(password).length < 6) {
    throw createHttpError(400, "El password debe tener al menos 6 caracteres");
  }

  const existingUser = await findUserByEmail(String(email).toLowerCase().trim());
  if (existingUser) throw createHttpError(409, "El email ya esta registrado");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    nombre: String(nombre).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
  });

  res.status(201).json({ user, token: signToken(user) });
});

export const login = asyncHandler(async (req, res) => {
  requireJwtSecret();
  const { email, password } = req.body;

  if (!email || !password) throw createHttpError(400, "email y password son obligatorios");

  const userWithPassword = await findUserByEmail(String(email).toLowerCase().trim());
  if (!userWithPassword) throw createHttpError(401, "Credenciales invalidas");

  const passwordMatches = await bcrypt.compare(password, userWithPassword.password_hash);
  if (!passwordMatches) throw createHttpError(401, "Credenciales invalidas");

  const user = await findUserById(userWithPassword.id);
  res.json({ user, token: signToken(user) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) throw createHttpError(404, "Usuario no encontrado");
  res.json({ user });
});
