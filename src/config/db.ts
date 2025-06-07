import mongoose from "mongoose";
import { MONGO_URI } from "../constants/env"

mongoose.set("bufferCommands", false);

const connectToDatabase = async () => {
    try {
        await mongoose.connect(
          "mongodb+srv://josepholofinte:joseph54321olofinte@cluster0.izd0aky.mongodb.net/sleat_db?retryWrites=true&w=majority&appName=Cluster0"
        );
        console.log("Successfully connected to the database!");
        
    } catch (error) {
        console.error("Error connecting to the database:", error);
        process.exit(1);
        
    }
}

export default connectToDatabase;