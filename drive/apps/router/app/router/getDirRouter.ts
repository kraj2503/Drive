/*

1. Remove .DS_store from response
2. Integrate Stream for large mp4 files
3. 

*/


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

const pathdir = process.env.PATHDIR;
const zipDir = process.env.ZIPDIR;

console.log(`pathdir`, pathdir);
console.log(`zipDir`, zipDir);

const router: ExpressRouter = Router();

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
      console.log("directory sent: ", files);

      res.json({
        files: files,
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
  try {
    await fsPromise.access(sourcePath, fs.constants.R_OK);
    console.log("filePath exists");
    fileExist = true;
  } catch (error) {
    console.log("file doesn't exist");
    return res.status(404).json({
      message: "File doesn't exist",
      code: 404,
    });
  }
  console.log("Dir exists");
  // console.log(`zipapth`, zipPath);

  if (fileExist) {
    // try {
      
      // await fsPromise.access(file, fs.constants.F_OK);
    //   console.log(`zip exists`);
    // } catch (e) {
    //   console.log("Zip does not exist. Creating now...");

    //   try {
    //     // Ensure the directory for the zip files exists (e.g. public_zip)
    //     await fsPromise.mkdir(path.dirname(zipPath), { recursive: true });

    //     await zip(sourcePath, zipPath); // Use zipPath, not zipName!
    //     console.log("Zip created successfully.");
    //   } catch (zipError) {
    //     console.log("Error creating zip:", zipError);
    //     return res.status(500).json({ message: "Failed to create zip" });
    //   }
    // }

    try {
      console.log(`Sending file`);

      res.download(sourcePath, (err) => {
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



export default router;
