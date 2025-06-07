// import { JWT_REFRESH_SECRET, JWT_SECRET } from "../constants/env";
// import jwt from "jsonwebtoken";
import VerificationCodeType from "../constants/verificationCodeTypes";
import SessionModel from "../models/session.model";
import UserModel from "../models/user.model";
import VerificationCodeModel from "../models/verificationCode.model";
import { fifteenMinutesFromNow, fiveMinutesAgo, ONE_DAY_IN_MS, oneHourFromNow, oneYearFromNow, thirtyDaysFromNow } from "../utils/date";
import appAssert from "../utils/appAssert";
import { CONFLICT, INTERNAL_SERVER_ERROR, NOT_FOUND, TOO_MANY_REQUESTS, UNAUTHORIZED } from "../constants/http";
import { RefreshTokenPayload, refreshTokenSignOptions, signToken, verifyToken } from "../utils/jwt";
import { sendMail } from "../utils/sendMail";
import { getPasswordResetTemplate, getVerifyEmailTemplate } from "../utils/emailTemplates";
import { APP_ORIGIN } from "../constants/env";
import { hashValue } from "../utils/bcrypt";
import { valid } from "joi";



export type CreateAccountParams = {
    email: string;
    name: string;
    password: string;
    userAgent?: string;
}

export const createAccount = async(data:CreateAccountParams) => {

  // verify if the user already exists and throw error
  const existingUser = await UserModel.exists({
    email: data.email,
  });

  appAssert(!existingUser, CONFLICT, "Email already exists");


  // create a new user
    const user = await UserModel.create({
        email: data.email,
        name: data.name,
        password: data.password,
    });

    const userId = user._id;


  // create a verification code
    const verificationCode = await VerificationCodeModel.create({
        userId,
        type: VerificationCodeType.EmailVerification,
        expiresAt: oneYearFromNow(),
    });

  // send a verification email
  const url = `${APP_ORIGIN}/email/verify/${verificationCode._id}`;

  const {
    error
  } = await sendMail({
    to: user.email,
    ...getVerifyEmailTemplate(url)
  });

  if (error) {
    console.log(error)
  }

  // create a new session
  const session = await SessionModel.create({
    userId,
    userAgent: data.userAgent,
  })
  

  // sign access and refresh tokens
  const refreshToken = signToken(
    { 
      sessionId: session._id 
    }, refreshTokenSignOptions
  );

  const accessToken = signToken(
    {
      userId,
      sessionId: session._id,
    },
  );

  // return the user and tokens
  return {
    user: user.omitPassword(),
    accessToken,
    refreshToken,
  };
};

type LoginParams = {
  email: string;
  password: string;
  userAgent?: string;
};

export const loginUser = async(
  {
    email, password, userAgent
  }: LoginParams
) => {
  // verify if the user exists
  const user = await UserModel.findOne({ email });
  appAssert(user, UNAUTHORIZED, "Invalid email or password");

  const isValid = await user.comparePassword(password);
  appAssert(isValid, UNAUTHORIZED, "Invalid email or password");

  // create a session
  const userId = user._id;
  const session = await SessionModel.create({
    userId,
    userAgent,
  });

  const sessionInfo = {
    sessionId: session._id,
  }

  // sign access and refresh tokens
  const refreshToken = signToken(sessionInfo, refreshTokenSignOptions)
  

  const accessToken = signToken(
    { ...sessionInfo, userId: user._id }
  )


  // return the user and tokens
  return {
    user: user.omitPassword(),
    accessToken,
    refreshToken,
  };
}


export const refreshUserAccessToken = async (refreshToken: string) => {
  // verify the refresh token
  const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, {
    secret: refreshTokenSignOptions.secret,
  });

  appAssert(payload, UNAUTHORIZED, "Invalid refresh token");

  // find the session
  const now = Date.now();

  const session = await SessionModel.findById(payload.sessionId);
  appAssert(session && session.expiresAt.getTime() > now, UNAUTHORIZED, "Session expired or does not exist");

  // refresh the session that expires within 24 hours
  const sessionNeedsRefresh = session.expiresAt.getTime() - now <= ONE_DAY_IN_MS;

  if (sessionNeedsRefresh) {
    session.expiresAt = thirtyDaysFromNow();
    await session.save();
  }


  // sign a new refresh token
  const newRefreshToken = sessionNeedsRefresh ? signToken(
    { sessionId: session._id },
    refreshTokenSignOptions
  ) : undefined;


  // sign a new access token
  const accessToken = signToken({
    userId: session.userId,
    sessionId: session._id,
  });

  return {
    accessToken,
    newRefreshToken,
  };
}

export const verifyEmail = async(code: string) => {
  // get the ver code
  const validCode = await VerificationCodeModel.findOne({
    _id: code,
    type: VerificationCodeType.EmailVerification,
    expiresAt: { $gt: new Date() },
  })

  appAssert(validCode, NOT_FOUND, "Invalid or expired verification code");

  // update user to verified true
  const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, { verified: true }, { new: true });

  appAssert(updatedUser, INTERNAL_SERVER_ERROR, "Failed to verify email address");

  // delete ver code
  await validCode.deleteOne();

  // return user
  return {
    user: updatedUser.omitPassword(),
  };
}

export const sendPasswordResetEmail = async (email: string) => {
  // get user by email
  const user = await UserModel.findOne({ email });
  appAssert(user, NOT_FOUND, "This account does not exist.");

  // check email sends rate limit
  const fiveMinAgo = fiveMinutesAgo();

  const countVerificationCodeDocuments = await VerificationCodeModel.countDocuments({
    userId: user._id,
    type: VerificationCodeType.PasswordReset,
    createdAt: { $gt: fiveMinAgo },
  })

  appAssert(countVerificationCodeDocuments <= 1, TOO_MANY_REQUESTS, "You have exceeded the attempt limit. Please try again later.")

  // create verification code
  const expiresAt = oneHourFromNow();

  const verificationCode = await VerificationCodeModel.create({
    userId: user._id,
    type: VerificationCodeType.PasswordReset,
    expiresAt,
  });

  // send verification email
  const url = `${APP_ORIGIN}/password/reset?code=${verificationCode._id}&exp=${expiresAt.getTime()}`;

  const { data, error } = await sendMail({
    to: user.email,
    ...getPasswordResetTemplate(url),
  });

  appAssert(data?.id, INTERNAL_SERVER_ERROR, `${error?.name} - ${error?.message}`)

  // return response
  return {
    url,
    emailId: data.id,
  };
};

type ResetPasswordParams = {
  password: string;
  verificationCode: string;
};

export const resetPassword = async (
  {password, verificationCode}: ResetPasswordParams
) => {
  // get the verification code
  const validCode = await VerificationCodeModel.findOne({
    _id: verificationCode,
    type: VerificationCodeType.PasswordReset,
    expiresAt: { $gt: Date.now()},
  });

  appAssert(validCode, NOT_FOUND, "Invalid or expired verification code.")

  // update user's password
  const updatedUser = await UserModel.findByIdAndUpdate(
    validCode.userId,
    {
      password: await hashValue(password),
    }
  )

  appAssert(updatedUser, INTERNAL_SERVER_ERROR, "failed to reset password");

  // delete verification code
  await validCode.deleteOne();

  // delete all sessions
  await SessionModel.deleteMany({
    userId: updatedUser.id,
  })

  return {
    user: updatedUser.omitPassword(),
  };
}