import type { EventArchetypeId, MemberTag } from "./event-archetypes"

export type PlanningScenarioId =
  | "chapter_general_meeting"
  | "summer_potluck"
  | "electoral_committee_meeting"
  | "labor_committee_meeting"
  | "trans_rights_committee_meeting"
  | "membership_political_education_committee"
  | "springfield_branch_meeting"
  | "franklin_branch_meeting"
  | "northampton_branch_meeting"
  | "amherst_branch_meeting"
  | "dsa_101"
  | "field_lead_training"
  | "springfield_canvass"
  | "greenfield_canvass"
  | "northampton_canvass"
  | "amherst_canvass"
  | "fundraising_phonebank"
  | "speaker_presentation"
  | "reading_group"
  | "long_festival"

export type PlanningScenario = {
  id: PlanningScenarioId
  archetypeId: EventArchetypeId
  label: string
  description: string
  targetTags: MemberTag[]
  broadAudience?: boolean
  examplesFromCalendar: string[]
}

export const PLANNING_SCENARIOS: Record<PlanningScenarioId, PlanningScenario> = {
  chapter_general_meeting: {
    id: "chapter_general_meeting",
    archetypeId: "general_meeting",
    label: "Chapter general meeting",
    description: "Broad chapter meeting where whole-org turnout matters most.",
    targetTags: ["broad_member"],
    broadAudience: true,
    examplesFromCalendar: ["Chapter General Meeting"],
  },

  summer_potluck: {
    id: "summer_potluck",
    archetypeId: "general_meeting",
    label: "Summer cookout / potluck",
    description: "Broad social chapter event where total turnout and weekend-friendly time matter.",
    targetTags: ["broad_member", "social"],
    broadAudience: true,
    examplesFromCalendar: ["Summer Cookout & Potluck - Moved to July 8th"],
  },

  electoral_committee_meeting: {
    id: "electoral_committee_meeting",
    archetypeId: "committee_meeting",
    label: "Electoral committee meeting",
    description: "Committee meeting targeting electoral/campaign members.",
    targetTags: ["electoral"],
    examplesFromCalendar: ["Electoral Committee Meeting"],
  },

  labor_committee_meeting: {
    id: "labor_committee_meeting",
    archetypeId: "committee_meeting",
    label: "Labor standing committee meeting",
    description: "Committee meeting targeting labor members.",
    targetTags: ["labor"],
    examplesFromCalendar: ["Labor Standing Committee"],
  },

  trans_rights_committee_meeting: {
    id: "trans_rights_committee_meeting",
    archetypeId: "committee_meeting",
    label: "Trans rights committee meeting",
    description: "Committee meeting targeting trans-rights members.",
    targetTags: ["trans_rights"],
    examplesFromCalendar: ["Trans Rights & Bodily Autonomy Committee"],
  },

  membership_political_education_committee: {
    id: "membership_political_education_committee",
    archetypeId: "committee_meeting",
    label: "Membership and political education committee",
    description: "Committee meeting targeting membership and political education members.",
    targetTags: ["membership", "political_education"],
    examplesFromCalendar: ["Membership & Political Education Committee"],
  },

  springfield_branch_meeting: {
    id: "springfield_branch_meeting",
    archetypeId: "branch_meeting",
    label: "Springfield branch meeting",
    description: "Regional branch meeting targeting Springfield members.",
    targetTags: ["branch_springfield"],
    examplesFromCalendar: ["Springfield Branch Meeting"],
  },

  franklin_branch_meeting: {
    id: "franklin_branch_meeting",
    archetypeId: "branch_meeting",
    label: "Franklin County branch meeting",
    description: "Regional branch meeting targeting Franklin County members.",
    targetTags: ["branch_franklin"],
    examplesFromCalendar: ["Franklin County Branch Meeting"],
  },

  northampton_branch_meeting: {
    id: "northampton_branch_meeting",
    archetypeId: "branch_meeting",
    label: "Northampton branch meeting",
    description: "Regional branch meeting targeting Northampton members.",
    targetTags: ["branch_northampton"],
    examplesFromCalendar: ["Northampton-area branch planning scenario"],
  },

  amherst_branch_meeting: {
    id: "amherst_branch_meeting",
    archetypeId: "branch_meeting",
    label: "Amherst branch meeting",
    description: "Regional branch meeting targeting Amherst members.",
    targetTags: ["branch_amherst"],
    examplesFromCalendar: ["Amherst-area branch planning scenario"],
  },

  dsa_101: {
    id: "dsa_101",
    archetypeId: "orientation",
    label: "DSA 101",
    description: "New-member orientation targeting newer members and membership/political education organizers.",
    targetTags: ["new_member", "membership", "political_education"],
    examplesFromCalendar: ["DSA 101 (Online)"],
  },

  field_lead_training: {
    id: "field_lead_training",
    archetypeId: "training",
    label: "Field lead training",
    description: "Training targeting campaign leaders and canvass-capable members.",
    targetTags: ["leader", "electoral", "canvass"],
    examplesFromCalendar: ["June Field Lead Training"],
  },

  springfield_canvass: {
    id: "springfield_canvass",
    archetypeId: "canvass",
    label: "Springfield canvass",
    description: "Field action targeting canvassers, electoral members, and Springfield members.",
    targetTags: ["canvass", "electoral", "branch_springfield"],
    examplesFromCalendar: ["Springfield Canvass"],
  },

  greenfield_canvass: {
    id: "greenfield_canvass",
    archetypeId: "canvass",
    label: "Greenfield canvass",
    description: "Field action targeting canvassers, electoral members, and Franklin County members.",
    targetTags: ["canvass", "electoral", "branch_franklin"],
    examplesFromCalendar: ["Greenfield People's Ballot Canvass"],
  },

  northampton_canvass: {
    id: "northampton_canvass",
    archetypeId: "canvass",
    label: "Northampton canvass",
    description: "Field action targeting canvassers, electoral members, and Northampton members.",
    targetTags: ["canvass", "electoral", "branch_northampton"],
    examplesFromCalendar: ["Northampton Canvass"],
  },

  amherst_canvass: {
    id: "amherst_canvass",
    archetypeId: "canvass",
    label: "Amherst canvass",
    description: "Field action targeting canvassers, electoral members, and Amherst members.",
    targetTags: ["canvass", "electoral", "branch_amherst"],
    examplesFromCalendar: ["Amherst People's Ballot Canvass"],
  },

  fundraising_phonebank: {
    id: "fundraising_phonebank",
    archetypeId: "phonebank",
    label: "Fundraising phonebank",
    description: "Phonebank targeting campaign, phonebank, and electoral members.",
    targetTags: ["phonebank", "electoral", "canvass"],
    examplesFromCalendar: ["People's Ballot Fundraising Phonebank"],
  },

  speaker_presentation: {
    id: "speaker_presentation",
    archetypeId: "presentation",
    label: "Speaker presentation",
    description: "Educational speaker event with broad appeal.",
    targetTags: ["political_education", "study_group", "broad_member"],
    broadAudience: true,
    examplesFromCalendar: ["The Human Face of Iran: a presentation"],
  },

  reading_group: {
    id: "reading_group",
    archetypeId: "reading_group",
    label: "Reading group",
    description: "Smaller discussion event targeting study-group and political education members.",
    targetTags: ["study_group", "political_education", "trans_rights"],
    examplesFromCalendar: [
      "Electoral Strategy Study Group",
      "Early Trans Liberation",
      "Trans Medicine Reading Series",
      "Trans Fiction – Stag Dance",
    ],
  },

  long_festival: {
    id: "long_festival",
    archetypeId: "festival",
    label: "Long festival / tabling event",
    description: "Long outdoor event where weekend daytime fit matters strongly.",
    targetTags: ["social", "weekend_day", "broad_member"],
    broadAudience: true,
    examplesFromCalendar: ["Read and Resist Fest", "Pride tabling / parade events"],
  },
}

export const PLANNING_SCENARIO_IDS = Object.keys(
  PLANNING_SCENARIOS,
) as PlanningScenarioId[]
