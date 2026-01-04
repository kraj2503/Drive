import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from "express";
import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";
import { zip } from "zip-a-folder";

const pathdir = process.env.PATHDIR ?? "";
const zipDir = process.env.ZIPDIR ?? "";

if (!pathdir || !zipDir) {
  console.warn("WARNING: PATHDIR or ZIPDIR env variables are missing.");
}

console.log(`pathdir`, pathdir);
console.log(`zipDir`, zipDir);

const router: ExpressRouter = Router();

const STREAM_THRESHOLD = 50 * 1024 * 1024; // 50MB
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".webm",
  ".flv",
  ".wmv",
]);

const getMimeType = (ext: string) => {
  const types: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
  };
  return types[ext] || "application/octet-stream";
};

router.get("/", async (req: Request, res: Response) => {
  // File system access only

  res.json({
    message: "Get router",
  });
});

router.get("/files{/:folder}", (req, res) => {
  console.log(__dirname);

  let { folder } = req.params;
  folder = folder?.replaceAll("+", "/");

  console.log(`requested path`, folder);

  fs.readdir(
    path.join(pathdir, folder ?? ""),

    (err, files) => {
      if (err) {
        console.log("Directory doesn't exist: ", err);
        res.json({
          message: "Folder doesn't exist",
          code: 404,
        });
      }
      const cleanFiles = files.filter(
        (file) => file !== ".DS_Store" && !file.startsWith("._")
      );

      console.log(`Sending ${cleanFiles.length} files`);

      res.json({
        files: cleanFiles,
        code: 200,
      });
    }
  );
});

router.get("/download/directory/:folder", async (req, res) => {
  let { folder } = req.params;
  folder = `${folder?.replaceAll("+", "/")}`;
  const zipFolder = `${folder?.replaceAll("+", "/")}.zip`;

  console.log(`requested path`, folder);
  const sourcePath = path.join(pathdir, folder);
  const zipPath = path.join(zipDir, zipFolder);

  let dirExist = false;
  try {
    await fsPromise.access(sourcePath, fs.constants.R_OK);
    console.log("Directory exists");
    dirExist = true;
  } catch (error) {
    console.log("Directory doesn't exist");
    return res.status(404).json({
      message: "Folder doesn't exist",
      code: 404,
    });
  }
  console.log("Dir exists");
  console.log(`zipapth`, zipPath);

  if (dirExist) {
    try {
      await fsPromise.access(zipPath, fs.constants.F_OK);
      console.log(`zip exists`);
    } catch (e) {
      console.log("Zip does not exist. Creating now...");

      try {
        // Ensure the directory for the zip files exists (e.g. public_zip)
        await fsPromise.mkdir(path.dirname(zipPath), { recursive: true });

        await zip(sourcePath, zipPath); // Use zipPath, not zipName!
        console.log("Zip created successfully.");
      } catch (zipError) {
        console.log("Error creating zip:", zipError);
        return res.status(500).json({ message: "Failed to create zip" });
      }
    }

    try {
      console.log(`Sending zip`);

      res.download(zipPath, (err) => {
        if (err && !res.headersSent) {
          console.log("Download error:", err);
        }
      });
    } catch (e) {
      console.log(e);
      return res.status(500).send("Error downloading");
    }
  }
});

router.get("/download/file/:filePath", async (req, res) => {
  let { filePath } = req.params;
  filePath = `${filePath?.replaceAll("+", "/")}`;
  // const zipFolder = `${file?.replaceAll("+", "/")}.zip`;

  // console.log(`reque sted file`, filePath);
  const sourcePath = path.join(pathdir, filePath);
  // const zipPath = path.join(zipDir, filePath);
  console.log(`sourcePath`, sourcePath);

  let fileExist = false;
  let stat;
  try {
    await fsPromise.access(sourcePath, fs.constants.R_OK);
    stat = await fsPromise.stat(sourcePath);

    console.log("filePath exists");
    fileExist = true;
  } catch (error) {
    console.log("file doesn't exist");
    return res.status(404).json({
      message: "File doesn't exist",
      code: 404,
    });
  }

  const fileSize = stat.size;
  const ext = path.extname(sourcePath).toLowerCase();
  const fileName = path.basename(sourcePath);
  if (VIDEO_EXTENSIONS.has(ext) && fileSize > STREAM_THRESHOLD) {
    console.log(
      `Large video detected (${(fileSize / 1024 / 1024).toFixed(2)} MB). Streaming...`
    );

    try {
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        // If end is not specified, go to the end of the file
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(sourcePath, { start, end });

        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": getMimeType(ext),
          // Clean name for browsers that decide to save the stream
          "Content-Disposition": `inline; filename="${fileName}"`,
        };

        res.writeHead(206, head); // 206 Partial Content
        fileStream.pipe(res);
      } else {
        // Initial request (no range header yet) - Send just the headers first
        // or stream the whole thing if the browser is dumb (rare)
        const head = {
          "Content-Length": fileSize,
          "Content-Type": getMimeType(ext),
          "Content-Disposition": `inline; filename="${fileName}"`,
        };
        res.writeHead(200, head);
        fs.createReadStream(sourcePath).pipe(res);
      }
      return; // Stop here, we are done
    } catch (err) {
      console.error("Streaming error:", err);
      if (!res.headersSent) res.status(500).send("Error streaming file");
      return;
    }
  }

  console.log("Serving standard file (small or non-video)...");
  res.sendFile(sourcePath, (err) => {
    if (err) {
      console.log("Error sending file:", err);
      if (!res.headersSent) res.status(500).send("Error downloading file");
    }
  });
});

export default router;
