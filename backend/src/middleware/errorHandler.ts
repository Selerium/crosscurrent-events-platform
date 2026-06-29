import express from "express";

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal server error";
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: true, message, data: {} });
};

export default errorHandler;