import express from "express";
import authRoutes from "./routes/auth.routes.js";
import dotenv from "dotenv";
import connectMongoDB from "./db/connectMongodb.js";
import cookieParser from "cookie-parser";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use(express.urlencoded({extended: true}));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectMongoDB();
});
