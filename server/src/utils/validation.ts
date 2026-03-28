import type { WebSocket } from 'ws';
import type { User, Game, CreateGameData } from '../types';

export const getUserByWebSocket = (
  wsToUserId: Map<WebSocket, string>,
  users: Map<string, User>,
  ws: WebSocket
): User | null => {
  const userId = wsToUserId.get(ws);
  if (!userId) return null;
  return users.get(userId) || null;
};

export const validateUserLoggedIn = (
  wsToUserId: Map<WebSocket, string>,
  users: Map<string, User>,
  ws: WebSocket
): { valid: boolean; user?: User; error?: string } => {
  const user = getUserByWebSocket(wsToUserId, users, ws);
  if (!user) {
    return { valid: false, error: 'User not logged in' };
  }
  return { valid: true, user };
};

export const validateGameExists = (
  games: Map<string, Game>,
  gameId: string
): { valid: boolean; game?: Game; error?: string } => {
  const game = games.get(gameId);
  if (!game) {
    return { valid: false, error: 'Game not found' };
  }
  return { valid: true, game };
};

export const validateGameCode = (
  gameCodes: Map<string, string>,
  games: Map<string, Game>,
  code: string
): { valid: boolean; game?: Game; error?: string } => {
  const gameId = gameCodes.get(code);
  if (!gameId) {
    return { valid: false, error: 'Invalid room code' };
  }
  return validateGameExists(games, gameId);
};

export const validateCreateGameData = (
  data: any
): { valid: boolean; gameData?: CreateGameData; error?: string } => {
  if (!data || !Array.isArray(data.questions)) {
    return { valid: false, error: 'Invalid game data: questions array required' };
  }
  if (data.questions.length === 0) {
    return { valid: false, error: 'At least one question is required' };
  }
  return { valid: true, gameData: data as CreateGameData };
};

export const isPlayerInGame = (
  games: Map<string, Game>,
  userId: string
): Game | null => {
  for (const game of games.values()) {
    if (game.status !== 'finished' && game.players.some(player => player.index === userId)) {
      return game;
    }
  }
  return null;
};

export const validateIsHost = (
  game: Game,
  userId: string
): { valid: boolean; error?: string } => {
  if (game.hostId !== userId) {
    return { valid: false, error: 'Only host can perform this action' };
  }
  return { valid: true };
};

export const validateGameState = (
  game: Game,
  expectedStatus: 'waiting' | 'in_progress' | 'finished'
): { valid: boolean; error?: string } => {
  if (game.status !== expectedStatus) {
    return {
      valid: false,
      error: `Game must be in ${expectedStatus} state`,
    };
  }
  return { valid: true };
};

export const validateAnswerData = (
  data: any
): { valid: boolean; error?: string } => {
  if (
    data.gameId === undefined ||
    data.questionIndex === undefined ||
    data.answerIndex === undefined
  ) {
    return { valid: false, error: 'Missing required fields' };
  }

  if (
    typeof data.gameId !== 'string' ||
    typeof data.questionIndex !== 'number' ||
    typeof data.answerIndex !== 'number'
  ) {
    return { valid: false, error: 'Invalid data types' };
  }

  if (data.questionIndex < 0 || data.answerIndex < 0) {
    return { valid: false, error: 'Indices must be non-negative' };
  }

  return { valid: true };
};

export const validateQuestionIndex = (
  game: Game,
  questionIndex: number
): { valid: boolean; error?: string } => {
  if (questionIndex !== game.currentQuestion) {
    return { valid: false, error: 'Invalid question index' };
  }
  return { valid: true };
};

export const validateAnswerIndex = (
  game: Game,
  answerIndex: number
): { valid: boolean; error?: string } => {
  const currentQuestion = game.questions[game.currentQuestion];
  if (answerIndex < 0 || answerIndex >= currentQuestion.options.length) {
    return { valid: false, error: 'Invalid answer index' };
  }
  return { valid: true };
};
