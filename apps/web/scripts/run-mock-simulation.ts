import fs from "node:fs"
import path from "node:path"

import { runMockSimulation, simulationToMarkdown } from "../src/lib/simulation/report"

const outputDir = path.resolve(process.cwd(), "../../tmp/mock-simulation")
fs.mkdirSync(outputDir, { recursive: true })

const seed = Number(process.env.MOCK_SIM_SEED ?? 20260705)
const memberCount = Number(process.env.MOCK_SIM_MEMBERS ?? 50)
const monthStart = process.env.MOCK_SIM_MONTH_START ?? "2026-08-01"
const monthEnd = process.env.MOCK_SIM_MONTH_END ?? "2026-08-31"

const result = runMockSimulation({
  seed,
  memberCount,
  monthStart,
  monthEnd,
  maxCandidatesPerScenario: 500,
})

const jsonPath = path.join(outputDir, "mock-event-simulation.json")
const mdPath = path.join(outputDir, "mock-event-simulation.md")

fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n")
fs.writeFileSync(mdPath, simulationToMarkdown(result) + "\n")

console.log(`Wrote ${jsonPath}`)
console.log(`Wrote ${mdPath}`)
