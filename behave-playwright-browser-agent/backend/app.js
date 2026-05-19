const express = require("express");
const cors = require("cors");

const PORT = parseInt(process.env.PORT || "8080", 10);
const LOG_HEADERS = process.env.LOG_HEADERS !== "false";
const LOG_ALL_HEADERS = process.env.LOG_ALL_HEADERS === "true";

const app = express();

// CORS: the SeaLights browser-agent (with OTEL enabled) adds dynamic headers
// to every fetch() -- baggage, traceparent, tracestate, persist, etc.
// Hard-coding an allowedHeaders list inevitably misses one. Omitting the
// option makes `cors` default to reflecting the request's
// Access-Control-Request-Headers, which is exactly what we want here.
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

function parseBaggageHeader(value) {
  if (!value) {
    return null;
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const idx = entry.indexOf("=");
      if (idx <= 0) {
        return acc;
      }
      const key = entry.slice(0, idx).trim();
      const raw = entry.slice(idx + 1).trim();
      try {
        acc[key] = decodeURIComponent(raw);
      } catch (_err) {
        acc[key] = raw;
      }
      return acc;
    }, {});
}

app.use((req, _res, next) => {
  if (!LOG_HEADERS) {
    return next();
  }

  const baggageRaw = req.headers["baggage"];
  const baggage = parseBaggageHeader(baggageRaw);
  const ts = new Date().toISOString();

  console.log(`\n[${ts}] ${req.method} ${req.originalUrl}`);
  if (baggage) {
    console.log("  baggage:");
    for (const [k, v] of Object.entries(baggage)) {
      const marker = k.startsWith("x-sl-") ? "  >>" : "    ";
      console.log(`${marker} ${k} = ${v}`);
    }
  } else {
    console.log("  baggage: <none>");
  }

  if (LOG_ALL_HEADERS) {
    console.log("  all headers:");
    for (const [k, v] of Object.entries(req.headers)) {
      console.log(`    ${k}: ${v}`);
    }
  }

  next();
});

function parseOperand(value) {
  if (value === undefined || value === null || value === "") {
    return NaN;
  }
  return Number(value);
}

app.get("/add", (req, res) => {
  const n1 = parseOperand(req.query.n1);
  const n2 = parseOperand(req.query.n2);
  if (Number.isNaN(n1) || Number.isNaN(n2)) {
    return res.status(400).json({ error: "n1 and n2 must be numbers" });
  }
  return res.json({ result: n1 + n2 });
});

app.get("/subtract", (req, res) => {
  const n1 = parseOperand(req.query.n1);
  const n2 = parseOperand(req.query.n2);
  if (Number.isNaN(n1) || Number.isNaN(n2)) {
    return res.status(400).json({ error: "n1 and n2 must be numbers" });
  }
  return res.json({ result: n1 - n2 });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Calculator backend listening on http://localhost:${PORT}`);
  if (LOG_HEADERS) {
    console.log(
      "  Header logging: ON (set LOG_HEADERS=false to silence, LOG_ALL_HEADERS=true to dump every header)"
    );
  }
});
