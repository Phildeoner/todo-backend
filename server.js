require("dotenv").config({ path: "./.env" });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
const axios = require("axios");
const apiKey = process.env.OPENAI_API_KEY;

const app = express();
const PORT = 5000;

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://phildeoner:Chemistry0419@cluster0.nklsaik.mongodb.net/?authSource=Cluster0&authMechanism=SCRAM-SHA-1",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

app.use(cors());
app.use(express.json());

// Define a simple schema and model for our Todo
const TodoSchema = new mongoose.Schema({
  task: String,
  completed: Boolean,
  tags: [String], // for tagging users
  hashtags: [String], // for hashtags
});

const Todo = mongoose.model("Todo", TodoSchema);

// Routes
app.get("/todos", async (req, res) => {
  try {
    const todos = await Todo.find();
    res.json(todos);
  } catch (error) {
    console.error("Error fetching todos:", error);
    res.status(500).json({ message: "Failed to fetch todos." });
  }
});

app.post("/todos", async (req, res) => {
  try {
    const newTodo = new Todo(req.body);
    await newTodo.save();
    res.json(newTodo);
  } catch (error) {
    console.error("Error saving todo:", error);
    res.status(500).json({ message: "Failed to save todo." });
  }
});

// Add this route to support delete functionality
app.delete("/todos/:id", async (req, res) => {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);
    if (!todo) return res.status(404).json({ message: "Todo not found" });
    res.json({ message: "Todo deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on https://localhost:5000:${PORT}`);
});

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

UserSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  } catch (error) {
    console.error("Error hashing password:", error);
    next(error); // Passing the error to the next middleware
  }
});

const User = mongoose.model("User", UserSchema);

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user with the hashed password
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(200).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Server Error. Failed to register user." });
  }
});

app.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    // Search for users
    const users = await User.find({ username: new RegExp(query, "i") });

    // Search for todos with hashtags
    const todos = await Todo.find({ hashtags: new RegExp(query, "i") });

    res.json({ users, todos });
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ error: "Server Error. Failed to perform search." });
  }
});

app.post("/create-todo", async (req, res) => {
  const { userInput } = req.body;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates to-do lists.",
          },
          { role: "user", content: userInput },
        ],
        temperature: 0.7,
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    let aiMessage = response.data.choices[0].message.content.trim();
    aiMessage = aiMessage.split("\n").slice(1).join("\n"); // Remove the first line
    const todos = aiMessage
      .split("\n")
      .filter((item) => item && item.length >= 5) // Filter out lines with length less than 5 characters
      .map((item) => item.replace(/^\d+\.\s*/, "")); // Remove numbering at the start of each line

    res.json({ todos });
  } catch (error) {
    console.error(
      "Detailed Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Error creating to-do list" });
  }
});

app.delete("/todos", async (req, res) => {
  try {
    await Todo.deleteMany({});
    res.status(200).send("All todos cleared");
  } catch (error) {
    console.error("Error clearing todos:", error);
    res.status(500).send("Error clearing todos");
  }
});

app.put("/todos/:id", async (req, res) => {
  try {
    const todoToUpdate = req.body;

    const updatedTodo = await Todo.findByIdAndUpdate(
      req.params.id,
      todoToUpdate,
      {
        new: true, // This ensures that the updated document is returned
      }
    );

    if (!updatedTodo) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.json(updatedTodo);
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(500).json({ message: "Failed to update todo." });
  }
});
