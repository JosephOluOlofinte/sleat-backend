import mongoose from "mongoose";
import { compareValue, hashValue } from "../utils/bcrypt";


export interface UserDocument extends mongoose.Document {
    email: string;
    name: string;
    password: string;
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
    comparePassword(value: string): Promise<boolean>;
    omitPassword(): Pick<UserDocument, "_id" | "email" | "name" | "verified" | "createdAt" | "updatedAt" | "__v">;
}

const userSchema = new mongoose.Schema<UserDocument>({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    verified: {
        type: Boolean,
        required: true,
        default: false,
    },
}, {
    timestamps: true,
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }

    this.password = await hashValue(this.password);
    return next();
});

userSchema.methods.comparePassword = async function (value: string) {
    return  compareValue(value, this.password);
};

userSchema.methods.omitPassword = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

const UserModel = mongoose.model<UserDocument>("User", userSchema);
export default UserModel;