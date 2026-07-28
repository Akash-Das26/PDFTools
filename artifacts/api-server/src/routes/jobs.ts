import { Router, type IRouter } from "express";
import { desc, sql, count, sum } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { CreateJobBody, ListJobsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const [totals] = await db
      .select({
        totalJobs: count(),
        filesProcessed: count(),
        totalInputSizeMb: sql<number>`COALESCE(SUM(${jobsTable.inputSizeBytes}), 0) / 1048576.0`,
        totalOutputSizeMb: sql<number>`COALESCE(SUM(${jobsTable.outputSizeBytes}), 0) / 1048576.0`,
      })
      .from(jobsTable);

    const [todayResult] = await db
      .select({ jobsToday: count() })
      .from(jobsTable)
      .where(sql`${jobsTable.createdAt} >= CURRENT_DATE`);

    const popularRows = await db
      .select({ tool: jobsTable.tool, cnt: count() })
      .from(jobsTable)
      .groupBy(jobsTable.tool)
      .orderBy(desc(count()))
      .limit(1);

    res.json({
      totalJobs: Number(totals?.totalJobs ?? 0),
      jobsToday: Number(todayResult?.jobsToday ?? 0),
      filesProcessed: Number(totals?.filesProcessed ?? 0),
      totalInputSizeMb: Number(Number(totals?.totalInputSizeMb ?? 0).toFixed(2)),
      totalOutputSizeMb: Number(Number(totals?.totalOutputSizeMb ?? 0).toFixed(2)),
      popularTool: popularRows[0]?.tool ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

  try {
    const jobs = await db
      .select()
      .from(jobsTable)
      .orderBy(desc(jobsTable.createdAt))
      .limit(limit);

    res.json(jobs.map(j => ({
      id: j.id,
      tool: j.tool,
      originalFilename: j.originalFilename,
      inputSizeBytes: j.inputSizeBytes,
      outputSizeBytes: j.outputSizeBytes,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list jobs");
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [job] = await db.insert(jobsTable).values({
      tool: parsed.data.tool,
      originalFilename: parsed.data.originalFilename,
      inputSizeBytes: parsed.data.inputSizeBytes,
      outputSizeBytes: parsed.data.outputSizeBytes ?? null,
      status: parsed.data.status,
    }).returning();

    res.status(201).json({
      id: job!.id,
      tool: job!.tool,
      originalFilename: job!.originalFilename,
      inputSizeBytes: job!.inputSizeBytes,
      outputSizeBytes: job!.outputSizeBytes,
      status: job!.status,
      createdAt: job!.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create job");
    res.status(500).json({ error: "Failed to create job" });
  }
});

export default router;
