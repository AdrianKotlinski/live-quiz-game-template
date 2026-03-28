import { randomUUID } from 'node:crypto';

export const generateUserId = (): string => randomUUID();

export const generateGameId = (): string => randomUUID();

export const generateGameCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () =>
    characters[Math.floor(Math.random() * characters.length)]
  ).join('');
};
