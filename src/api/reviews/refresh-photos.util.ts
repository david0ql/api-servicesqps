import { join } from 'path';

import { ADMIN_LIKE_ROLE_IDS, ROLE_MANAGER, ROLE_QA, ROLE_SUPERVISOR } from '../../constants/roles';

/**
 * Refresh por fotos (QA): la QA ya no llena el checklist, solo saca fotos de
 * lo que quedo mal. Las fotos se suben antes de mandar la revision
 * (POST /reviews/photos/upload) y luego se mandan sus photoPath en
 * POST /reviews/service-review (refreshPhotos).
 *
 * Se guardan en uploads/service-refresh con nombre aleatorio y se sirven
 * estaticas por /uploads (main.ts), igual que las imagenes de news, para que
 * la app y la web las carguen con un <Image>/<img> sin token.
 */

export const REFRESH_PHOTOS_PUBLIC_PREFIX = '/uploads/service-refresh/';
export const REFRESH_PHOTOS_DIR = join(process.cwd(), 'uploads', 'service-refresh');
export const MAX_REFRESH_PHOTO_SIZE = 10 * 1024 * 1024;
export const MAX_REFRESH_PHOTOS_PER_REVIEW = 30;

const PHOTO_PATH_REGEX = /^\/uploads\/service-refresh\/[A-Za-z0-9._-]+$/;

/** Solo se aceptan rutas que devolvio el upload (evita guardar rutas arbitrarias). */
export const isValidRefreshPhotoPath = (photoPath: unknown): photoPath is string =>
  typeof photoPath === 'string' && PHOTO_PATH_REGEX.test(photoPath) && !photoPath.includes('..');

export const normalizeRefreshPhotos = (photos: unknown): string[] => {
  if (!Array.isArray(photos)) return [];
  const unique = new Set<string>();
  for (const photo of photos) {
    if (typeof photo === 'string' && photo.trim()) unique.add(photo.trim());
  }
  return Array.from(unique);
};

export const buildRefreshPhotoUrl = (photoPath: string, baseUrl: string | null | undefined): string => {
  if (/^https?:\/\//i.test(photoPath)) return photoPath;
  const base = (baseUrl || '').replace(/\/+$/, '');
  return `${base}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
};

export const isAllowedImageUpload = (file: { mimetype?: string; originalname?: string }) =>
  /^image\//i.test(file.mimetype ?? '') || /\.(hei[cf]|jpe?g|png|webp)$/i.test(file.originalname ?? '');

export const isHeicUpload = (file: { mimetype?: string; originalname?: string }) =>
  /^image\/hei[cf]$/i.test(file.mimetype ?? '') || /\.hei[cf]$/i.test(file.originalname ?? '');

const VIEWER_ROLE_IDS = new Set<string>([...ADMIN_LIKE_ROLE_IDS, ROLE_QA, ROLE_MANAGER, ROLE_SUPERVISOR]);

/** Admin, QA, manager/supervisor o el cleaner asignado al servicio. */
export const canViewRefreshPhotos = (
  user: { id?: string | null; roleId?: string | null } | null | undefined,
  service: { userId?: string | null } | null | undefined,
): boolean => {
  if (!user?.id) return false;
  if (VIEWER_ROLE_IDS.has(String(user.roleId ?? ''))) return true;
  return !!service?.userId && String(service.userId) === String(user.id);
};

export interface RefreshPhotoRow {
  id: string;
  round: number;
  photoPath: string;
  createdByUserId: string | null;
  message: string | null;
  createdAt: Date | string;
}

export interface RefreshPhotosRound {
  round: number;
  createdAt: string;
  qaUser: { id: string; name: string } | null;
  message: string | null;
  photos: Array<{ id: string; url: string }>;
}

const toIso = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

/** Agrupa las filas por ronda, la mas reciente primero. */
export const groupRefreshPhotosByRound = (
  rows: RefreshPhotoRow[],
  usersById: Map<string, { id: string; name: string }>,
  baseUrl: string | null | undefined,
): RefreshPhotosRound[] => {
  const rounds = new Map<number, RefreshPhotosRound>();
  const sorted = [...rows].sort((a, b) => Number(a.id) - Number(b.id));

  for (const row of sorted) {
    const roundNumber = Number(row.round) || 1;
    let round = rounds.get(roundNumber);
    if (!round) {
      const user = row.createdByUserId ? usersById.get(String(row.createdByUserId)) : undefined;
      round = {
        round: roundNumber,
        createdAt: toIso(row.createdAt),
        qaUser: user ? { id: String(user.id), name: user.name } : null,
        message: row.message ?? null,
        photos: [],
      };
      rounds.set(roundNumber, round);
    }
    round.photos.push({ id: String(row.id), url: buildRefreshPhotoUrl(row.photoPath, baseUrl) });
  }

  return Array.from(rounds.values()).sort((a, b) => b.round - a.round);
};
