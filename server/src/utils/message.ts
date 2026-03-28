import type { WebSocket } from 'ws';
import type { WSMessage, Game } from '../types';

export const sendMessage = (ws: WebSocket, type: string, data: any): void => {
  if (ws.readyState === ws.OPEN) {
    const message: WSMessage = { type, data, id: 0 };
    ws.send(JSON.stringify(message));
  }
};

export const broadcastToGame = (game: Game, type: string, data: any): void => {
  game.players.forEach(player => {
    if (player.ws) {
      sendMessage(player.ws, type, data);
    }
  });
};

export const parseMessage = (rawMessage: string): WSMessage | null => {
  try {
    const message = JSON.parse(rawMessage);
    if (typeof message.type === 'string' && message.data !== undefined) {
      return message as WSMessage;
    }
    return null;
  } catch {
    return null;
  }
};
