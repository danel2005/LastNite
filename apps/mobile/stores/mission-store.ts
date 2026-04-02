import { create } from 'zustand'
import type { ActiveMissionSummary } from '@lastnite/shared'

interface MissionStoreState {
  // Current user's active missions only — NEVER other users' missions
  myMissions: ActiveMissionSummary[]
  completingMissionId: string | null // ID of mission currently being submitted

  setMyMissions: (missions: ActiveMissionSummary[]) => void
  setCompletingMission: (id: string | null) => void
  markCompleted: (assignmentId: string) => void
}

export const useMissionStore = create<MissionStoreState>((set) => ({
  myMissions: [],
  completingMissionId: null,

  setMyMissions: (missions) => set({ myMissions: missions }),
  setCompletingMission: (id) => set({ completingMissionId: id }),

  markCompleted: (assignmentId) =>
    set((state) => ({
      myMissions: state.myMissions.filter((m) => m.assignmentId !== assignmentId),
    })),
}))
