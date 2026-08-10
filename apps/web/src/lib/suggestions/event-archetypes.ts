export const EVENT_ARCHETYPE_IDS = [
  "general_meeting",
  "committee_meeting",
  "branch_meeting",
  "orientation",
  "training",
  "canvass",
  "phonebank",
  "presentation",
  "reading_group",
  "festival",
] as const

export type EventArchetypeId =
  (typeof EVENT_ARCHETYPE_IDS)[number]

export type MemberTag =
  | "broad_member"
  | "leader"
  | "electoral"
  | "labor"
  | "trans_rights"
  | "political_education"
  | "membership"
  | "branch_springfield"
  | "branch_franklin"
  | "branch_northampton"
  | "branch_amherst"
  | "canvass"
  | "phonebank"
  | "new_member"
  | "study_group"
  | "social"
  | "weekday_evening"
  | "weekend_day"

export type PreferredWindow = {
  dayOfWeek: number // Luxon weekday: 1=Mon ... 7=Sun
  startMinute: number
  endMinute: number
}

export type EventScoreWeights = {
  targetTurnout: number
  broadTurnout: number
  timeFit: number
  fairness: number
  inconvenience: number
}

export type EventArchetype = {
  id: EventArchetypeId
  label: string
  description: string
  durationMinutes: number
  stepMinutes: number
  dayStartMinute: number
  dayEndMinute: number
  targetTags: MemberTag[]
  broadAudience: boolean
  preferredWindows: PreferredWindow[]
  weights: EventScoreWeights
  examplesFromCalendar: string[]
}

const h = (hour: number, minute = 0) => hour * 60 + minute

const weekdayEvenings = [1, 2, 3, 4].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: h(18),
  endMinute: h(20),
}))

const weekendDaytime = [6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: h(10),
  endMinute: h(16),
}))

export const EVENT_ARCHETYPES: Record<EventArchetypeId, EventArchetype> = {
  general_meeting: {
    id: "general_meeting",
    label: "General meeting / potluck",
    description: "Broad org meeting where total turnout matters most.",
    durationMinutes: 150,
    stepMinutes: 15,
    dayStartMinute: h(9),
    dayEndMinute: h(21),
    targetTags: ["broad_member"],
    broadAudience: true,
    preferredWindows: [
      { dayOfWeek: 3, startMinute: h(17, 30), endMinute: h(20, 30) },
      { dayOfWeek: 6, startMinute: h(12), endMinute: h(17) },
    ],
    weights: {
      targetTurnout: 0.25,
      broadTurnout: 0.4,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: [
      "Summer Cookout & Potluck",
      "Chapter General Meeting",
    ],
  },

  committee_meeting: {
    id: "committee_meeting",
    label: "Committee meeting",
    description: "Standing committee meeting where target-member turnout matters more than whole-org turnout.",
    durationMinutes: 120,
    stepMinutes: 15,
    dayStartMinute: h(17),
    dayEndMinute: h(21),
    targetTags: ["electoral", "labor", "trans_rights", "political_education"],
    broadAudience: false,
    preferredWindows: weekdayEvenings,
    weights: {
      targetTurnout: 0.5,
      broadTurnout: 0.15,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: [
      "Electoral Committee Meeting",
      "Labor Standing Committee",
      "Trans Rights & Bodily Autonomy Committee",
      "International and Palestine Committee",
    ],
  },

  branch_meeting: {
    id: "branch_meeting",
    label: "Branch meeting",
    description: "Regional meeting where branch-tagged members matter most.",
    durationMinutes: 120,
    stepMinutes: 15,
    dayStartMinute: h(17),
    dayEndMinute: h(21),
    targetTags: [
      "branch_springfield",
      "branch_franklin",
      "branch_northampton",
      "branch_amherst",
    ],
    broadAudience: false,
    preferredWindows: weekdayEvenings,
    weights: {
      targetTurnout: 0.55,
      broadTurnout: 0.1,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: [
      "Springfield Branch Meeting",
      "Franklin County Branch Meeting",
    ],
  },

  orientation: {
    id: "orientation",
    label: "DSA 101 / new-member orientation",
    description: "Intro event where new-member availability matters most, but broad turnout still helps.",
    durationMinutes: 60,
    stepMinutes: 15,
    dayStartMinute: h(12),
    dayEndMinute: h(21),
    targetTags: ["new_member", "membership", "political_education"],
    broadAudience: false,
    preferredWindows: [
      ...weekdayEvenings,
      { dayOfWeek: 6, startMinute: h(13), endMinute: h(17) },
      { dayOfWeek: 7, startMinute: h(13), endMinute: h(17) },
    ],
    weights: {
      targetTurnout: 0.45,
      broadTurnout: 0.2,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: ["DSA 101 (Online)"],
  },

  training: {
    id: "training",
    label: "Training",
    description: "Skill-building event where target organizers matter, usually on weekends or evenings.",
    durationMinutes: 120,
    stepMinutes: 15,
    dayStartMinute: h(9),
    dayEndMinute: h(21),
    targetTags: ["canvass", "electoral", "leader"],
    broadAudience: false,
    preferredWindows: [
      ...weekendDaytime,
      { dayOfWeek: 2, startMinute: h(18), endMinute: h(20, 30) },
      { dayOfWeek: 4, startMinute: h(18), endMinute: h(20, 30) },
    ],
    weights: {
      targetTurnout: 0.5,
      broadTurnout: 0.15,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: ["Field Lead Training"],
  },

  canvass: {
    id: "canvass",
    label: "Canvass / field action",
    description: "Field action where canvass-tagged members and weekend daytime fit matter.",
    durationMinutes: 120,
    stepMinutes: 15,
    dayStartMinute: h(9),
    dayEndMinute: h(20),
    targetTags: ["canvass", "electoral", "branch_springfield", "branch_franklin"],
    broadAudience: false,
    preferredWindows: [
      ...weekendDaytime,
      { dayOfWeek: 2, startMinute: h(17, 30), endMinute: h(19, 30) },
      { dayOfWeek: 4, startMinute: h(17, 30), endMinute: h(19, 30) },
    ],
    weights: {
      targetTurnout: 0.45,
      broadTurnout: 0.15,
      timeFit: 0.25,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: [
      "People’s Ballot Launch Canvass",
      "Springfield Canvass",
      "Greenfield People's Ballot Canvass",
      "Northampton Canvass",
      "Amherst People's Ballot Canvass",
    ],
  },

  phonebank: {
    id: "phonebank",
    label: "Phonebank",
    description: "Remote or office-based phonebank where phonebank/campaign members matter.",
    durationMinutes: 120,
    stepMinutes: 15,
    dayStartMinute: h(12),
    dayEndMinute: h(21),
    targetTags: ["phonebank", "electoral", "canvass"],
    broadAudience: false,
    preferredWindows: [
      { dayOfWeek: 2, startMinute: h(17, 30), endMinute: h(20, 30) },
      { dayOfWeek: 3, startMinute: h(17, 30), endMinute: h(20, 30) },
      { dayOfWeek: 4, startMinute: h(17, 30), endMinute: h(20, 30) },
      { dayOfWeek: 6, startMinute: h(13), endMinute: h(18) },
    ],
    weights: {
      targetTurnout: 0.45,
      broadTurnout: 0.2,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: ["People's Ballot Fundraising Phonebank"],
  },

  presentation: {
    id: "presentation",
    label: "Presentation / speaker event",
    description: "Educational presentation where broad attendance and evening time fit both matter.",
    durationMinutes: 90,
    stepMinutes: 15,
    dayStartMinute: h(12),
    dayEndMinute: h(21),
    targetTags: ["political_education", "study_group", "broad_member"],
    broadAudience: true,
    preferredWindows: weekdayEvenings,
    weights: {
      targetTurnout: 0.3,
      broadTurnout: 0.3,
      timeFit: 0.25,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: ["The Human Face of Iran: a presentation"],
  },

  reading_group: {
    id: "reading_group",
    label: "Reading group / study group",
    description: "Smaller discussion event where study-group members and calm evening windows matter.",
    durationMinutes: 90,
    stepMinutes: 15,
    dayStartMinute: h(12),
    dayEndMinute: h(21),
    targetTags: ["study_group", "political_education", "trans_rights"],
    broadAudience: false,
    preferredWindows: [
      { dayOfWeek: 3, startMinute: h(18), endMinute: h(20, 30) },
      { dayOfWeek: 4, startMinute: h(18), endMinute: h(20, 30) },
      { dayOfWeek: 7, startMinute: h(14), endMinute: h(17) },
    ],
    weights: {
      targetTurnout: 0.5,
      broadTurnout: 0.15,
      timeFit: 0.2,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: [
      "Electoral Strategy Study Group",
      "Early Trans Liberation",
      "Trans Medicine Reading Series",
      "Trans Fiction – Stag Dance",
    ],
  },

  festival: {
    id: "festival",
    label: "Festival / long outdoor event",
    description: "Long outdoor community event where weekend daytime fit is very important.",
    durationMinutes: 360,
    stepMinutes: 30,
    dayStartMinute: h(8),
    dayEndMinute: h(18),
    targetTags: ["social", "broad_member", "weekend_day"],
    broadAudience: true,
    preferredWindows: [
      { dayOfWeek: 6, startMinute: h(10), endMinute: h(16) },
      { dayOfWeek: 7, startMinute: h(10), endMinute: h(16) },
    ],
    weights: {
      targetTurnout: 0.25,
      broadTurnout: 0.3,
      timeFit: 0.3,
      fairness: 0.1,
      inconvenience: 0.05,
    },
    examplesFromCalendar: ["Read and Resist Fest", "Pride tabling / parade events"],
  },
}
