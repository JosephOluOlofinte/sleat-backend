import mongoose from "mongoose";
import { MONGO_URI } from "../constants/env"

const connectToDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Successfully connected to the database!");
        
    } catch (error) {
        console.error("Error connecting to the database:", error);
        process.exit(1);
        
    }
}

export default connectToDatabase;