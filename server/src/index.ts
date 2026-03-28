import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import type { User, Game, RegData, CreateGameData, JoinGameData, StartGameData, AnswerData, Player } from './types';
import { generateUserId, generateGameId, generateGameCode } from './utils/generators';
import { sendMessage, parseMessage, broadcastToGame } from './utils/message';
import {
  validateUserLoggedIn,
  validateCreateGameData,
  validateGameCode,
  isPlayerInGame,
  validateIsHost,
  validateGameState,
  validateAnswerData,
  validateQuestionIndex,
  validateAnswerIndex,
} from './utils/validation';
import { broadcastQuestion, endQuestion, checkAllPlayersAnswered } from './utils/game';
import { ERROR_MESSAGES, sendError } from './utils/error';
import { handlePlayerDisconnect, cleanupGame, findGameByPlayerId } from './utils/cleanup';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const users = new Map<string, User>();
const games = new Map<string, Game>();
const gameCodes = new Map<string, string>();
const wsToUserId = new Map<WebSocket, string>();

const wss = new WebSocketServer({ port: PORT });

const findUserByName = (name: string): User | undefined => {
  return Array.from(users.values()).find(user => user.name === name);
};

const cleanupStaleGameAssociations = (userId: string): void => {
  const game = findGameByPlayerId(games, userId);

  if (!game) return;

  console.log(`Cleaning up stale game association for user on re-login (game: ${game.code}, status: ${game.status})`);

  if (game.hostId === userId) {
    broadcastToGame(game, 'error', {
      message: 'Host reconnected in new session. Game cancelled.'
    });
    cleanupGame(game, games, gameCodes);
    console.log(`Cleaned up game ${game.code} (host re-login)`);
  } else {
    game.players = game.players.filter(p => p.index !== userId);
    broadcastToGame(game, 'update_players', game.players);
    console.log(`Removed user from game ${game.code} on re-login`);

    if (game.players.length === 0) {
      cleanupGame(game, games, gameCodes);
      console.log(`Cleaned up empty game ${game.code}`);
    }
  }
};

const handleRegistration = (ws: WebSocket, data: any): void => {
  const { name, password } = data as RegData;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    sendMessage(ws, 'reg', { error: true, errorText: 'Valid name required' });
    return;
  }

  if (!password || typeof password !== 'string' || password.trim() === '') {
    sendMessage(ws, 'reg', { error: true, errorText: 'Valid password required' });
    return;
  }

  const existingUser = findUserByName(name);

  if (existingUser) {
    if (existingUser.password !== password) {
      sendMessage(ws, 'reg', { error: true, errorText: 'Invalid password' });
      return;
    }

    const oldWs = existingUser.ws;
    if (oldWs && oldWs !== ws) {
      oldWs.close();
    }

    existingUser.ws = ws;
    wsToUserId.set(ws, existingUser.index);

    cleanupStaleGameAssociations(existingUser.index);

    sendMessage(ws, 'reg', { name: existingUser.name, index: existingUser.index, error: false });
    console.log(`User logged in: ${name}`);
    return;
  }

  const userId = generateUserId();
  const newUser: User = { name, password, index: userId, ws };
  users.set(userId, newUser);
  wsToUserId.set(ws, userId);
  sendMessage(ws, 'reg', { name, index: userId, error: false });
  console.log(`User registered: ${name}`);
};

const handleCreateGame = (ws: WebSocket, data: any): void => {
  const userValidation = validateUserLoggedIn(wsToUserId, users, ws);
  if (!userValidation.valid) {
    sendError(ws, userValidation.error || ERROR_MESSAGES.NOT_LOGGED_IN);
    return;
  }

  const dataValidation = validateCreateGameData(data);
  if (!dataValidation.valid) {
    sendError(ws, dataValidation.error || ERROR_MESSAGES.INVALID_GAME_DATA);
    return;
  }

  const user = userValidation.user!;
  const gameData = dataValidation.gameData!;

  const existingGame = isPlayerInGame(games, user.index);
  if (existingGame) {
    sendError(ws, ERROR_MESSAGES.ALREADY_IN_GAME);
    return;
  }

  const gameId = generateGameId();
  const code = generateGameCode();

  const hostPlayer: Player = {
    name: user.name,
    index: user.index,
    score: 0,
    ws: user.ws,
  };

  const game: Game = {
    id: gameId,
    code,
    hostId: user.index,
    questions: gameData.questions,
    players: [hostPlayer],
    currentQuestion: 0,
    status: 'waiting',
    playerAnswers: new Map(),
  };

  games.set(gameId, game);
  gameCodes.set(code, gameId);

  sendMessage(ws, 'game_created', { gameId, code });
  sendMessage(ws, 'update_players', game.players);

  console.log(`Game created: ${code} by ${user.name}`);
};

const handleJoinGame = (ws: WebSocket, data: any): void => {
  const userValidation = validateUserLoggedIn(wsToUserId, users, ws);
  if (!userValidation.valid) {
    sendError(ws, userValidation.error || ERROR_MESSAGES.NOT_LOGGED_IN);
    return;
  }

  const { code } = data as JoinGameData;
  if (!code || typeof code !== 'string') {
    sendError(ws, 'Room code required');
    return;
  }

  const gameValidation = validateGameCode(gameCodes, games, code);
  if (!gameValidation.valid) {
    sendError(ws, gameValidation.error || ERROR_MESSAGES.INVALID_ROOM_CODE);
    return;
  }

  const user = userValidation.user!;
  const game = gameValidation.game!;

  if (game.status !== 'waiting') {
    sendError(ws, ERROR_MESSAGES.GAME_IN_PROGRESS);
    return;
  }

  const existingGame = isPlayerInGame(games, user.index);
  if (existingGame) {
    sendError(ws, ERROR_MESSAGES.ALREADY_IN_GAME);
    return;
  }

  const newPlayer: Player = {
    name: user.name,
    index: user.index,
    score: 0,
    ws: user.ws,
  };

  game.players.push(newPlayer);

  sendMessage(ws, 'game_joined', { gameId: game.id });
  broadcastToGame(game, 'player_joined', {
    playerName: user.name,
    playerCount: game.players.length,
  });
  broadcastToGame(game, 'update_players', game.players);

  console.log(`Player ${user.name} joined game ${code}`);
};

const handleStartGame = (ws: WebSocket, data: any): void => {
  const userValidation = validateUserLoggedIn(wsToUserId, users, ws);
  if (!userValidation.valid) {
    sendError(ws, userValidation.error || ERROR_MESSAGES.NOT_LOGGED_IN);
    return;
  }

  const { gameId } = data as StartGameData;
  if (!gameId || typeof gameId !== 'string') {
    sendError(ws, 'Game ID required');
    return;
  }

  const game = games.get(gameId);
  if (!game) {
    sendError(ws, ERROR_MESSAGES.GAME_NOT_FOUND);
    return;
  }

  const user = userValidation.user!;

  const hostValidation = validateIsHost(game, user.index);
  if (!hostValidation.valid) {
    sendError(ws, hostValidation.error || ERROR_MESSAGES.NOT_HOST);
    return;
  }

  const stateValidation = validateGameState(game, 'waiting');
  if (!stateValidation.valid) {
    sendError(ws, ERROR_MESSAGES.GAME_ALREADY_STARTED);
    return;
  }

  if (game.questions.length === 0) {
    sendError(ws, ERROR_MESSAGES.EMPTY_QUESTIONS);
    return;
  }

  game.status = 'in_progress';
  broadcastQuestion(game);

  console.log(`Game ${game.code} started by ${user.name}`);
};

const handleAnswer = (ws: WebSocket, data: any): void => {
  const userValidation = validateUserLoggedIn(wsToUserId, users, ws);
  if (!userValidation.valid) {
    sendError(ws, userValidation.error || ERROR_MESSAGES.NOT_LOGGED_IN);
    return;
  }

  const dataValidation = validateAnswerData(data);
  if (!dataValidation.valid) {
    sendError(ws, dataValidation.error || ERROR_MESSAGES.MISSING_FIELDS);
    return;
  }

  const { gameId, questionIndex, answerIndex } = data as AnswerData;

  const game = games.get(gameId);
  if (!game) {
    sendError(ws, ERROR_MESSAGES.GAME_NOT_FOUND);
    return;
  }

  if (game.status !== 'in_progress') {
    sendError(ws, ERROR_MESSAGES.GAME_NOT_IN_PROGRESS);
    return;
  }

  const user = userValidation.user!;
  const player = game.players.find(p => p.index === user.index);

  if (!player) {
    sendError(ws, ERROR_MESSAGES.NOT_IN_GAME);
    return;
  }

  if (player.index === game.hostId) {
    sendError(ws, ERROR_MESSAGES.HOST_CANNOT_ANSWER);
    return;
  }

  const questionValidation = validateQuestionIndex(game, questionIndex);
  if (!questionValidation.valid) {
    sendError(ws, questionValidation.error || ERROR_MESSAGES.INVALID_QUESTION_INDEX);
    return;
  }

  if (game.playerAnswers.has(player.index)) {
    sendError(ws, ERROR_MESSAGES.ALREADY_ANSWERED);
    return;
  }

  const answerValidation = validateAnswerIndex(game, answerIndex);
  if (!answerValidation.valid) {
    sendError(ws, answerValidation.error || ERROR_MESSAGES.INVALID_ANSWER_INDEX);
    return;
  }

  game.playerAnswers.set(player.index, {
    answerIndex,
    timestamp: Date.now(),
  });

  player.hasAnswered = true;

  sendMessage(ws, 'answer_accepted', { questionIndex });

  if (checkAllPlayersAnswered(game)) {
    endQuestion(game);
  }

  console.log(`Player ${user.name} answered question ${questionIndex + 1} in game ${game.code}`);
};

const handleMessage = (ws: WebSocket, rawMessage: string): void => {
  const message = parseMessage(rawMessage);

  if (!message) {
    sendError(ws, ERROR_MESSAGES.INVALID_MESSAGE_FORMAT);
    return;
  }

  try {
    switch (message.type) {
      case 'reg':
        handleRegistration(ws, message.data);
        break;
      case 'create_game':
        handleCreateGame(ws, message.data);
        break;
      case 'join_game':
        handleJoinGame(ws, message.data);
        break;
      case 'start_game':
        handleStartGame(ws, message.data);
        break;
      case 'answer':
        handleAnswer(ws, message.data);
        break;
      default:
        sendError(ws, ERROR_MESSAGES.UNKNOWN_MESSAGE_TYPE);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(ws, ERROR_MESSAGES.INTERNAL_ERROR);
  }
};

const handleDisconnection = (ws: WebSocket): void => {
  const userId = wsToUserId.get(ws);
  if (userId) {
    const user = users.get(userId);
    if (user) {
      handlePlayerDisconnect(userId, user, games, gameCodes, wsToUserId);
    }
  }
};

wss.on('connection', (ws: WebSocket) => {
  console.log('New connection established');

  ws.on('message', (rawMessage: Buffer) => {
    handleMessage(ws, rawMessage.toString());
  });

  ws.on('close', () => {
    handleDisconnection(ws);
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);