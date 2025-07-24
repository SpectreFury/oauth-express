import "dotenv/config"

import express from "express";
import cors from 'cors'

const app = express();

import { authRouter } from "./routes/auth.routes";

const PORT = process.env.PORT || 3000;

app.use(cors())
app.use("/auth", authRouter)

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
