import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "pv_pharma_jwt_secret_super_secure_enterprise_key_2026_98829471",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  corsOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000", "http://localhost:3001"],
};
