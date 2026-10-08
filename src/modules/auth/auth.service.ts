import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { config } from "../../config/index.js";
import prisma from "../../db/prisma.js";

const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static createToken(user: { id: string; email: string; role: string; companyId?: string | null }): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId || undefined,
        type: "access",
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );
  }

  static async verifyGoogleIdToken(idToken: string) {
    if (!googleClient) {
      throw new Error("Google Client ID is not configured on the server");
    }
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    return ticket.getPayload();
  }
}
