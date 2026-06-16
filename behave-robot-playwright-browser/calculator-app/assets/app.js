(function () {
  "use strict";

  var BACKEND_URL =
    window.__BACKEND_URL__ || "http://localhost:8080";

  function isValidNumber(value) {
    if (value === null || value === undefined) {
      return false;
    }
    var trimmed = String(value).trim();
    if (trimmed === "") {
      return false;
    }
    return !isNaN(Number(trimmed));
  }

  function parseNumber(value) {
    return Number(String(value).trim());
  }

  function formatResult(value) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(2);
  }

  function setError(message) {
    document.getElementById("error").textContent = message || "";
  }

  function setResult(text, status) {
    var el = document.getElementById("result");
    el.textContent = text;
    el.setAttribute("data-status", status || "ok");
  }

  function readInputs() {
    var raw1 = document.getElementById("number1").value;
    var raw2 = document.getElementById("number2").value;
    if (!isValidNumber(raw1) || !isValidNumber(raw2)) {
      setError("Please enter two valid numbers.");
      setResult("", "error");
      return null;
    }
    setError("");
    return { n1: parseNumber(raw1), n2: parseNumber(raw2) };
  }

  function callBackend(path, params) {
    var qs =
      "?n1=" + encodeURIComponent(params.n1) + "&n2=" + encodeURIComponent(params.n2);
    return fetch(BACKEND_URL + path + qs, {
      method: "GET",
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Backend returned " + response.status);
      }
      return response.json();
    });
  }

  function handleAdd() {
    var inputs = readInputs();
    if (!inputs) {
      return;
    }
    setResult("…", "loading");
    callBackend("/add", inputs)
      .then(function (data) {
        setResult(formatResult(data.result), "ok");
      })
      .catch(function (err) {
        setError("Add failed: " + err.message);
        setResult("", "error");
      });
  }

  function handleSubtract() {
    var inputs = readInputs();
    if (!inputs) {
      return;
    }
    setResult("…", "loading");
    callBackend("/subtract", inputs)
      .then(function (data) {
        setResult(formatResult(data.result), "ok");
      })
      .catch(function (err) {
        setError("Subtract failed: " + err.message);
        setResult("", "error");
      });
  }

  function handleReset() {
    document.getElementById("number1").value = "";
    document.getElementById("number2").value = "";
    setResult("", "idle");
    setError("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("addBtn").addEventListener("click", handleAdd);
    document
      .getElementById("subtractBtn")
      .addEventListener("click", handleSubtract);
    document.getElementById("resetBtn").addEventListener("click", handleReset);
  });
})();
