export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
};

export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const payload = {
    message: status === 500 ? "Error interno del servidor" : err.message,
  };

  if (process.env.NODE_ENV !== "production" && status === 500) {
    payload.error = err.message;
  }

  res.status(status).json(payload);
};
