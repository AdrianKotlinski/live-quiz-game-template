import { WebSocketServer, WebSocket } from 'ws';
import type { User, Game, RegData, CreateGameData, JoinGameData, StartGameData, AnswerData, Player } from './types';
import { generateUserId, generateGameId, generateGameCode } from './utils/generators';
import { sendMessage, parseMessage, broadcastToGame } from './utils/message';
import {
  validateUserLoggedIn,
  validateCreateGameData,
  validateGameCode,
  isPlayerInGame,
} from './utils/validation';
import { broadcastQuestion, endQuestion, checkAllPlayersAnswered } from './utils/game';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const users = new Map<string, User>();
const games = new Map<string, Game>();
const gameCodes = new Map<string, string>();
const wsToUserId = new Map<WebSocket, string>();

const wss = new WebSocketServer({ port: PORT });

const findUserByName = (name: string): User | undefined => {
  return Array.from(users.values()).find(user => user.name === name);
};

const handleRegistration = (ws: WebSocket, data: any): void => {
  const { name, password } = data as RegData;

  if (!name || !password) {
    sendMessage(ws, 'reg', { error: true, errorText: 'Name and password required' });
    return;
  }

  const existingUser = findUserByName(name);

  if (existingUser) {
    if (existingUser.password !== password) {
      sendMessage(ws, 'reg', { error: true, errorText: 'Invalid password' });
      return;
    }

    existingUser.ws = ws;
    wsToUserId.set(ws, existingUser.index);
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
    sendMessage(ws, 'error', { message: userValidation.error });
    return;
  }

  const dataValidation = validateCreateGameData(data);
  if (!dataValidation.valid) {
    sendMessage(ws, 'error', { message: dataValidation.error });
    return;
  }

  const user = userValidation.user!;
  const gameData = dataValidation.gameData!;

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
    sendMessage(ws, 'error', { message: userValidation.error });
    return;
  }

  const { code } = data as JoinGameData;
  if (!code) {
    sendMessage(ws, 'error', { message: 'Room code required' });
    return;
  }

  const gameValidation = validateGameCode(gameCodes, games, code);
  if (!gameValidation.valid) {
    sendMessage(ws, 'error', { message: gameValidation.error });
    return;
  }

  const user = userValidation.user!;
  const game = gameValidation.game!;

  if (game.status !== 'waiting') {
    sendMessage(ws, 'error', { message: 'Cannot join game in progress' });
    return;
  }

  const existingGame = isPlayerInGame(games, user.index);
  if (existingGame) {
    sendMessage(ws, 'error', { message: 'Already in a game' });
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
    sendMessage(ws, 'error', { message: userValidation.error });
    return;
  }

  const { gameId } = data as StartGameData;
  if (!gameId) {
    sendMessage(ws, 'error', { message: 'Game ID required' });
    return;
  }

  const game = games.get(gameId);
  if (!game) {
    sendMessage(ws, 'error', { message: 'Game not found' });
    return;
  }

  const user = userValidation.user!;
  if (game.hostId !== user.index) {
    sendMessage(ws, 'error', { message: 'Only host can start the game' });
    return;
  }

  if (game.status !== 'waiting') {
    sendMessage(ws, 'error', { message: 'Game already started' });
    return;
  }

  game.status = 'in_progress';
  broadcastQuestion(game);

  console.log(`Game ${game.code} started by ${user.name}`);
};

const handleAnswer = (ws: WebSocket, data: any): void => {
  const userValidation = validateUserLoggedIn(wsToUserId, users, ws);
  if (!userValidation.valid) {
    sendMessage(ws, 'error', { message: userValidation.error });
    return;
  }

  const { gameId, questionIndex, answerIndex } = data as AnswerData;

  if (gameId === undefined || questionIndex === undefined || answerIndex === undefined) {
    sendMessage(ws, 'error', { message: 'Missing required fields' });
    return;
  }

  const game = games.get(gameId);
  if (!game) {
    sendMessage(ws, 'error', { message: 'Game not found' });
    return;
  }

  if (game.status !== 'in_progress') {
    sendMessage(ws, 'error', { message: 'Game is not in progress' });
    return;
  }

  const user = userValidation.user!;
  const player = game.players.find(p => p.index === user.index);

  if (!player) {
    sendMessage(ws, 'error', { message: 'Player not in game' });
    return;
  }

  if (player.index === game.hostId) {
    sendMessage(ws, 'error', { message: 'Host cannot submit answers' });
    return;
  }

  if (questionIndex !== game.currentQuestion) {
    sendMessage(ws, 'error', { message: 'Invalid question index' });
    return;
  }

  if (game.playerAnswers.has(player.index)) {
    sendMessage(ws, 'error', { message: 'Already answered this question' });
    return;
  }

  const currentQuestion = game.questions[game.currentQuestion];
  if (answerIndex < 0 || answerIndex >= currentQuestion.options.length) {
    sendMessage(ws, 'error', { message: 'Invalid answer index' });
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
    sendMessage(ws, 'error', { message: 'Invalid message format' });
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
        sendMessage(ws, 'error', { message: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendMessage(ws, 'error', { message: 'Internal server error' });
  }
};

const handleDisconnection = (ws: WebSocket): void => {
  const userId = wsToUserId.get(ws);
  if (userId) {
    const user = users.get(userId);
    if (user) {
      console.log(`User disconnected: ${user.name}`);
    }
    wsToUserId.delete(ws);
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