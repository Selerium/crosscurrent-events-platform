import express from "express";

const meHandler = express.Router();

meHandler.get("", async (req, res) => {
  res.status(200).json({ data: req.user, error: false, message: "" });
});

export default meHandler;
