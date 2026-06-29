import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";

const checkTokens = async (req, res, next) => {
    const accessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;
    const jwtsecret = process.env.JWT_SECRET || "";

    if (accessToken) {
        try {
            const decoded = jwt.verify(accessToken, jwtsecret);
            req.user = decoded;
            return next();
        } catch (err) {
            if (err.name !== "TokenExpiredError") {
                throw new AppError("Invalid access token", 401);
            }
        }
    }

    if (!refreshToken) {
        throw new AppError("No access token provided", 401);
    }

    let decodedRefresh;
    try {
        decodedRefresh = jwt.verify(refreshToken, jwtsecret);
    } catch {
        throw new AppError("Invalid refresh token", 401);
    }

    const storedTokens = await prisma.refreshTokens.findMany({
        where: { userId: decodedRefresh.id, revokedAt: null },
    });

    let matchedToken = null;
    for (const stored of storedTokens) {
        const match = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (match) {
            matchedToken = stored;
            break;
        }
    }

    if (!matchedToken) {
        throw new AppError("Refresh token has been revoked", 401);
    }

    const user = await prisma.user.findUnique({
        where: { id: decodedRefresh.id },
        include: { profile: true },
    });

    if (!user || !user.profile) {
        throw new AppError("User not found", 401);
    }

    const newAccessToken = jwt.sign(
        {
            id: user.profile.id,
            name: user.profile.name,
            role: user.profile.role,
            firstTime: user.profile.firstTime,
        },
        jwtsecret,
        { expiresIn: "15m", subject: user.profile.id },
    );

    const newRefreshToken = jwt.sign(
        { id: user.id },
        jwtsecret,
        { expiresIn: "7d", subject: user.id },
    );

    await prisma.refreshTokens.update({
        where: { id: matchedToken.id },
        data: { revokedAt: new Date() },
    });

    let maxRetries = 3;
    while (maxRetries > 0) {
        const refreshHash = await bcrypt.hash(newRefreshToken, 10);
        try {
            await prisma.refreshTokens.create({
                data: {
                    tokenHash: refreshHash,
                    userId: user.id,
                },
            });
            break;
        } catch {
            maxRetries--;
        }
    }

    if (maxRetries === 0) {
        throw new AppError("Could not generate refresh token", 500);
    }

    res.cookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.user = jwt.verify(newAccessToken, jwtsecret);
    next();
};

export default checkTokens;
