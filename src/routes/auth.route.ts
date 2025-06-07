import { Router } from "express";
import { loginHandler, logoutHandler, refreshHandler, registerHandler, resetPasswordHandler, sendPasswordResetHandler, verifyEmailHandler } from "../controllers/auth.controller";


const authRoutes = Router();

// prefix: /auth
authRoutes.post('/register', registerHandler);
authRoutes.post('/login', loginHandler);
authRoutes.get("/logout", logoutHandler);
authRoutes.get("/refresh", refreshHandler);
authRoutes.get("/email/verify/:code", verifyEmailHandler);
authRoutes.post("/password/forgot", sendPasswordResetHandler);
authRoutes.post("/password/reset", resetPasswordHandler);

export default authRoutes;
// This is a simple auth route file that handles user registration and login