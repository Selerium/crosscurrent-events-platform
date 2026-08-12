import express from "express";

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: true, message: "Internal Server Error", data: {} });
};

export default errorHandler;