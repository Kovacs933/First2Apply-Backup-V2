import { CvProfile, GeneratedCv } from '@first2apply/core';

/** A CV the candidate saved in Foundation, filed in a folder (by default, the role it was made for). */
export type SavedCv = {
  id: string;
  name: string;
  folder: string;
  targetRole: string;
  createdAt: string;
  cv: GeneratedCv;
  // the contact details at the time, so the CV looks the same when it's opened again
  profile: CvProfile;
};

// kept on this computer only, like the CV Builder's form
const STORAGE_KEY = 'foundation-cv-library';

export function loadCvLibrary(): SavedCv[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Returns false when the CVs couldn't be saved (e.g. the computer's app storage is full). */
export function saveCvLibrary(cvs: SavedCv[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cvs));
    return true;
  } catch {
    return false;
  }
}

/** The folders, A to Z, each with its CVs newest first. */
export function cvFolders(cvs: SavedCv[]): Array<{ folder: string; cvs: SavedCv[] }> {
  const folders = new Map<string, SavedCv[]>();
  for (const cv of cvs) {
    const folder = cv.folder.trim() || 'Other';
    folders.set(folder, [...(folders.get(folder) ?? []), cv]);
  }
  return [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, list]) => ({ folder, cvs: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }));
}

export const newCvId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
