import { CookieOptions, Request, Response } from "express";

const setCookie = (res: Response, key: string, value: string, options: CookieOptions) => {
    res.cookie(key, value, options);
};

const getCookie = (req: Request, key: string) => {
    return req.cookies?.[key];
};

const clearCookie = (res: Response, key: string, options?: CookieOptions) => {
    res.clearCookie(key, options);
};

const setSessionCookie = (res: Response, token: string, maxAgeDays = 7) => {
    res.cookie("better-auth.session_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    });
};

const clearSessionCookie = (res: Response) => {
    res.clearCookie("better-auth.session_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
    });
};

export const CookieUtils = {
    setCookie,
    getCookie,
    clearCookie,
    setSessionCookie,
    clearSessionCookie,
};
