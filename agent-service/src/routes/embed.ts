import { Router } from "express";
import { embedSingle } from "../lib/embeddings.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string") {
      res.status(400).json({
        error: { code: "MISSING_TEXT", message: "text is required" },
      });
      return;
    }

    const embedding = await embedSingle(text);
    res.json({ embedding });
  } catch (err) {
    next(err);
  }
});

export { router as embedRouter };
