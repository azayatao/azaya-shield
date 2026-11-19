import { validateProfile } from "./pac.js";

export function pickRandomProxyProfile(profiles, currentId) {
  const valid = profiles.filter((profile) => !validateProfile(profile));
  const alternatives = valid.filter((profile) => profile.id !== currentId);
  const choices = alternatives.length ? alternatives : valid;
  return choices[Math.floor(Math.random() * choices.length)] ?? null;
}
