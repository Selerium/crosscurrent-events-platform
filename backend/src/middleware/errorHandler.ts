import express from "express";

const errorHandler = (err, req, res, next) => {
  res.status(err.statusCode).json({ error: true, message: err.message, data: {} });
  next();
};

export default errorHandler;