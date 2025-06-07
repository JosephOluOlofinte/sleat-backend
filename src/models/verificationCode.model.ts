import mongoose from "mongoose";
import VerificationCodeType from "../constants/verificationCodeTypes";


export interface VerificationCodeDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  type: VerificationCodeType;
  expiresAt: Date;
  createdAt: Date;
}

const verificationCodeSchema = new mongoose.Schema<VerificationCodeDocument>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
    index: true,
  },
  type: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
});

const VerificationCodeModel = mongoose.model<VerificationCodeDocument>("VerificationCode", verificationCodeSchema, "verification_codes");

export default VerificationCodeModel;