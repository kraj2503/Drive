import { Router, Request, Response , type Router as ExpressRouter } from "express";

const router:ExpressRouter = Router();

router.post("/", async (req: Request, res: Response) => {
  // File system access only

  res.json({
    message: "post router",
  });
});



export default router;
