import "dotenv/config";
import express from 'express';
import cors from 'cors';
import connectToDatabase from './config/db';
import { APP_ORIGIN, NODE_ENV, PORT } from "./constants/env";
import cookieParser from "cookie-parser";
import errorHandler from "./middlewares/errorHandler";
import catchErrors from "./utils/catchErrors";
import { OK } from "./constants/http";
import authRoutes from "./routes/auth.route";
import authenticate from "./middlewares/authenticate";
import userRoutes from "./routes/user.route";
import sessionRoutes from "./routes/session.route";


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: APP_ORIGIN,
    credentials: true,
}));
app.use(cookieParser());



app.get('/', (req, res, next) => {
    // This is a simple health check endpoint
    res.status(OK).json({
      status: "Healthy",
      message:
        "Your connection is healthy, and you are now in the root directory!",
    });
  });

// Auth routes
app.use("/auth", authRoutes);

// protected routes
app.use("/user", authenticate, userRoutes);
app.use("/sessions", authenticate, sessionRoutes);


app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT} in the ${NODE_ENV} environment!`);

  // Connect to DB
  await connectToDatabase();
});


