const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database("./database.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    balance REAL DEFAULT 0,
    lifetime REAL DEFAULT 0,
    count INTEGER DEFAULT 0
)
`);

app.get("/", (req,res)=>{
    res.send("Backend is running");
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) {
            db.run(
                "INSERT INTO users (email, password) VALUES (?, ?)",
                [email, password],
                function () {
                    res.json({ email, balance: 0, lifetime: 0, count: 0 });
                }
            );
        } else {
            if (user.password === password) {
                res.json(user);
            } else {
                res.status(401).json({ message: "Wrong password" });
            }
        }
    });
});

app.post("/complete", (req, res) => {
    const { email, reward } = req.body;

    db.run(
        "UPDATE users SET balance = balance + ?, lifetime = lifetime + ?, count = count + 1 WHERE email = ?",
        [reward, reward, email],
        function () {
            res.json({ message: "Survey completed" });
        }
    );
});

app.get("/user/:email", (req, res) => {
    db.get("SELECT * FROM users WHERE email = ?", [req.params.email], (err, user) => {
        res.json(user);
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port " + port));
