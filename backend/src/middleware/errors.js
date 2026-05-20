export function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(err, _req, res, _next) {
  const status = Number(err.status) || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({
    error: {
      message,
      status
    }
  });
}
