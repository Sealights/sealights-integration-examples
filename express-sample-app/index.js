const express = require("express");

const app = express();

function middleware(req, res, next) {
  console.log("Middleware called");
}

app.get("/", (req, res) => {
  middleware();

  res.send("Hello World!");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
