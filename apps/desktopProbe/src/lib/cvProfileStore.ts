import { CvProfile } from '@first2apply/core';

export type WritingMode = 'ai' | 'template';
export type CvBuilderState = { targetRole: string; profile: CvProfile; existingCv: string; mode: WritingMode };

// kept on this computer only, so the CV Builder is filled in next time and the Apply assistant can use it
const STORAGE_KEY = 'foundation-cv-builder';

export const EMPTY_PROFILE: CvProfile = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedinUrl: '',
  summary: '',
  skills: [],
  experience: [{ title: '', employer: '', dates: '', details: '' }],
  education: [{ qualification: '', place: '', dates: '' }],
};

export function loadCvBuilderState(): CvBuilderState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.profile) {
      return { targetRole: '', existingCv: '', mode: 'template', ...saved, profile: { ...EMPTY_PROFILE, ...saved.profile } };
    }
  } catch {
    // ignore a broken saved form
  }
  return { targetRole: '', profile: EMPTY_PROFILE, existingCv: '', mode: 'template' };
}

export function saveCvBuilderState(state: CvBuilderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // the form still works without saving
  }
}
