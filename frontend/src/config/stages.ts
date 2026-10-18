export const STAGES = {
  "1-auth": 1,
  "2-pagination": 2,
  "3-throttling": 3,
  "4-celery-config": 4,
  "5-notifications": 5,
  "6-sse": 6,
  "7-notification-tasks": 7,
  "8-celery-beat": 8,
  "9-workspaces": 9,
  "10-clients": 10,
  "11-tags": 11,
  "12-projects": 12,
  "13-time-tracking": 13,
  "14-timesheet": 14,
  "15-timesheet-filters": 15,
  "16-cache": 16,
} as const

export type StageName = keyof typeof STAGES

const envStage = import.meta.env.VITE_QUERA_CLOCK_STAGE as StageName | undefined

export const currentStage: StageName =
  envStage && STAGES[envStage] ? envStage : "1-auth"

export const stageEnabled = (stage: StageName) => STAGES[currentStage] >= STAGES[stage]

export const fallbackPathForStage = () => {
  if (stageEnabled("13-time-tracking")) return "/timesheet"
  if (stageEnabled("12-projects")) return "/projects"
  if (stageEnabled("11-tags")) return "/tags"
  if (stageEnabled("10-clients")) return "/clients"
  if (stageEnabled("9-workspaces")) return "/workspaces"
  if (stageEnabled("5-notifications")) return "/notifications"
  return "/profile"
}
