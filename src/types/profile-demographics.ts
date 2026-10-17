export const profileAgeRanges = [
  "under_18",
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_plus",
] as const;

export type ProfileAgeRange = (typeof profileAgeRanges)[number];

export const profileGenders = [
  "male",
  "female",
  "prefer_not_to_say",
] as const;

export type ProfileGender = (typeof profileGenders)[number];
