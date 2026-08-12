import express from "express";

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message =
    status >= 500
      ? "Internal server error"
      : err.message || "Internal sever error";
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: true, message, data: {} });
};

export default errorHandler;
