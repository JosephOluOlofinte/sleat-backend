import { ErrorRequestHandler, Response } from "express";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from "../constants/http";
import { z } from "zod";
import AppError from "../utils/AppError";
import { clearAuthCookies, REFRESH_PATH } from "../utils/cookies";


const handleZodError = (res: Response, error: z.ZodError) => {
  const errors = error.issues.map((err) => ({
    path: err.path.join("."),
    message: err.message
  }))


  return res.status(BAD_REQUEST).json({
    status: "Error",
    message: error.message,
    errors
})
}

const handleAppError = (res: Response, error: AppError) => {
  return res.status(error.statusCode).json({
    status: "Error",
    message: error.message,
    code: error.errorCode
  });
};

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    console.log(`PATH: ${req.path}`, error);

    // clear cookies if error occurs on the refresh endpoint
    // This is to prevent issues with stale tokens
    if (req.path === REFRESH_PATH) {
      clearAuthCookies(res);
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
        handleZodError(res, error);
        return;
    }

    // Handle custom AppError
    if (error instanceof AppError) {
      handleAppError(res, error);
      return;
    }
    

    res.status(INTERNAL_SERVER_ERROR).json({
      status: "Error",
      message: "Internal server error"
    });
    return;
}

export default errorHandler;