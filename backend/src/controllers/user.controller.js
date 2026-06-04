import { createHttpError, asyncHandler } from "../middleware/errorHandler.js";
import { findUserById, updateUserProfile } from "../models/user.model.js";

export const getProfile = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) throw createHttpError(404, "Usuario no encontrado");
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const currentUser = await findUserById(req.user.id);
  if (!currentUser) throw createHttpError(404, "Usuario no encontrado");

  const incomingName = req.body.name ?? req.body.nombre;
  const nombre = incomingName === undefined ? currentUser.nombre : String(incomingName).trim();
  if (!nombre) throw createHttpError(400, "nombre es obligatorio");
  const bio = req.body.bio === undefined ? currentUser.bio : String(req.body.bio || "").trim();
  if (bio.length > 300) throw createHttpError(400, "bio no puede superar 300 caracteres");

  const user = await updateUserProfile(req.user.id, {
    nombre,
    avatar_url: req.body.avatar_url === undefined ? currentUser.avatar_url : String(req.body.avatar_url || "").trim(),
    bio,
  });

  res.json({ user });
});
