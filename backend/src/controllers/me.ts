import express from "express";
import jwt from "jsonwebtoken";

const meHandler = express.Router();

meHandler.get("", async (req, res) => {
  const accessToken = req.cookies.access_token;

  const decodedToken = jwt.verify(accessToken, process.env.JWT_SECRET || "");
  res.status(200).json({ data: decodedToken, error: false, message: "" });
});

export default meHandler;
