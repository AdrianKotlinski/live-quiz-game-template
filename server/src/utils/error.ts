import type { WebSocket } from 'ws';
import { sendMessage } from './message';

export const ERROR_MESSAGES = {
  NOT_LOGGED_IN: 'User not logged in',
  GAME_NOT_FOUND: 'Game not found',
  INVALID_ROOM_CODE: 'Invalid room code',
  NOT_HOST: 'Only host can perform this action',
  ALREADY_IN_GAME: 'Already in a game',
  GAME_IN_PROGRESS: 'Cannot join game in progress',
  GAME_FINISHED: 'Game has finished',
  GAME_NOT_IN_PROGRESS: 'Game is not in progress',
  GAME_ALREADY_STARTED: 'Game already started',
  INVALID_GAME_DATA: 'Invalid game data',
  EMPTY_QUESTIONS: 'At least one question is required',
  MISSING_FIELDS: 'Missing required fields',
  INVALID_QUESTION_INDEX: 'Invalid question index',
  INVALID_ANSWER_INDEX: 'Invalid answer index',
  ALREADY_ANSWERED: 'Already answered this question',
  HOST_CANNOT_ANSWER: 'Host cannot submit answers',
  NOT_IN_GAME: 'Player not in game',
  INVALID_MESSAGE_FORMAT: 'Invalid message format',
  UNKNOWN_MESSAGE_TYPE: 'Unknown message type',
  INTERNAL_ERROR: 'Internal server error',
} as const;

export const sendError = (ws: WebSocket, message: string): void => {
  sendMessage(ws, 'error', { message });
};
