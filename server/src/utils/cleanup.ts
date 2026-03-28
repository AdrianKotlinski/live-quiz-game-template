import type { WebSocket } from 'ws';
import type { Game, User } from '../types';
import { broadcastToGame } from './message';

export const handlePlayerDisconnect = (
  userId: string,
  user: User,
  games: Map<string, Game>,
  gameCodes: Map<string, string>,
  wsToUserId: Map<WebSocket, string>
): void => {
  console.log(`User disconnected: ${user.name}`);

  const game = findGameByPlayerId(games, userId);

  if (game) {
    const player = game.players.find(p => p.index === userId);

    if (player) {
      if (game.hostId === userId) {
        broadcastToGame(game, 'error', {
          message: 'Host disconnected. Game cancelled.'
        });
        cleanupGame(game, games, gameCodes);
      } else {
        game.players = game.players.filter(p => p.index !== userId);
        broadcastToGame(game, 'update_players', game.players);
        console.log(`Player ${user.name} removed from game ${game.code}`);

        if (game.players.length === 0) {
          console.log(`Game ${game.code} is empty, cleaning up`);
          cleanupGame(game, games, gameCodes);
        }
      }
    }
  }

  if (user.ws) {
    wsToUserId.delete(user.ws);
  }
};

export const cleanupGame = (
  game: Game,
  games: Map<string, Game>,
  gameCodes: Map<string, string>
): void => {
  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = undefined;
  }

  games.delete(game.id);
  gameCodes.delete(game.code);
  console.log(`Game ${game.code} cleaned up`);
};

export const findGameByPlayerId = (
  games: Map<string, Game>,
  userId: string
): Game | null => {
  for (const game of games.values()) {
    if (game.players.some(player => player.index === userId)) {
      return game;
    }
  }
  return null;
};
