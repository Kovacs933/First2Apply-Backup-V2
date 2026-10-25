import { CvProfile } from '@first2apply/core';

export type WritingMode = 'ai' | 'template';
export type CvBuilderState = {
  targetRole: string;
  profile: CvProfile;
  existingCv: string;
  mode: WritingMode;
  // the CV file the candidate uploaded, shown under the upload button so they can remove it
  uploadedCv?: { fileName: string; text: string };
};

// kept on this computer only, so the CV Builder is filled in next time and the Apply assistant can use it
const STORAGE_KEY = 'foundation-cv-builder';
const SCHOOL = /\b(university|college|school|academy|institute|sixth form|polytechnic)\b/i;

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
      const profile: CvProfile = { ...EMPTY_PROFILE, ...saved.profile };
      // forms saved before Qualifications had its own section kept training under Education:
      // move undated entries that aren't a school, college or university across
      if (!saved.profile.qualifications) {
        const isTraining = (e: CvProfile['education'][number]) =>
          !e.dates?.trim() && !!e.qualification.trim() && !SCHOOL.test(e.place);
        profile.qualifications = profile.education.filter(isTraining);
        profile.education = profile.education.filter((e) => !isTraining(e));
      }
      return { targetRole: '', existingCv: '', mode: 'template', ...saved, profile };
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
