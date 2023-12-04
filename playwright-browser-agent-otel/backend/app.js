const express = require("express");
const cors = require("cors");

const PORT = parseInt(process.env.PORT || "8080");
const app = express();
app.use(cors());

app.get("/add", (req, res) => {
  console.log(req.headers);
  return res.send({
    result: parseFloat(req.query.n1) + parseFloat(req.query.n2),
  });
});

app.get("/subtract", (req, res) => {
  console.log(req.headers);

  return res.send({
    result: parseFloat(req.query.n1) - parseFloat(req.query.n2),
  });
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
