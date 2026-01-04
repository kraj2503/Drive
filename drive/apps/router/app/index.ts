import express from "express";
import getDir from "./router/getDirRouter";
import uploadFile from "./router/uploadRouter";

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url, req.body);
  next();
});

app.use("/api/v1/getDir", getDir);

app.use("/api/v1/upload", uploadFile);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`backend server is running on`, PORT);
});
