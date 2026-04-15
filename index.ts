import express, { type Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "secret123";

if (!MONGO_URI) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("MongoDB error:", err));

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  gender: { type: String, default: "" },
  nationality: { type: String, default: "" },
  dob: { type: String, default: "" },
  balance: { type: Number, default: 0 },
  lifetime: { type: Number, default: 0 },
  surveyCount: { type: Number, default: 0 },
  lastSurveyDate: { type: String, default: "" }
});
const User = mongoose.model("User", UserSchema);

function auth(req: any, res: Response, next: NextFunction) {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
}

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, gender, nationality, dob } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });
    const hashed = await bcrypt.hash(password, 10);
    user = new User({ email, password: hashed, name, gender, nationality, dob });
    await user.save();
    res.json({ msg: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });
    const match = await bcrypt.compare(password, user.password as string);
    if (!match) return res.status(400).json({ msg: "Wrong password" });
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.get("/api/survey/dashboard", auth, async (req: any, res: Response) => {
  try {
    const user: any = await User.findById(req.user.id);
    const today = new Date().toDateString();
    if (user.lastSurveyDate !== today) {
      user.surveyCount = 0;
      user.lastSurveyDate = today;
      await user.save();
    }
    res.json({
      balance: user.balance,
      lifetime: user.lifetime,
      surveyCount: user.surveyCount,
      user: { name: user.name, gender: user.gender, nationality: user.nationality, dob: user.dob }
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/api/survey/complete", auth, async (req: any, res: Response) => {
  try {
    const { reward } = req.body;
    const user: any = await User.findById(req.user.id);
    const today = new Date().toDateString();
    if (user.lastSurveyDate !== today) {
      user.surveyCount = 0;
      user.lastSurveyDate = today;
    }
    if (user.surveyCount >= 4) return res.status(400).json({ msg: "Daily limit reached" });
    user.balance += parseFloat(reward);
    user.lifetime += parseFloat(reward);
    user.surveyCount++;
    await user.save();
    res.json({ balance: user.balance, lifetime: user.lifetime, surveyCount: user.surveyCount });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/api/survey/withdraw", auth, async (req: any, res: Response) => {
  try {
    const user: any = await User.findById(req.user.id);
    if (user.balance < 34) return res.status(400).json({ msg: "Minimum withdrawal is $34" });
    user.balance = 0;
    await user.save();
    res.json({ msg: "Withdrawal successful" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ msg: "Not Found" });
});

const port = parseInt(process.env.PORT || "5000", 10);
app.listen(port, "0.0.0.0", () => console.log(`Server running on port ${port}`));
