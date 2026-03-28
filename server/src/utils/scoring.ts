import type { Player, Game } from '../types';
import { BASE_POINTS } from '../constants';

export interface PlayerResult {
  name: string;
  answered: boolean;
  correct: boolean;
  pointsEarned: number;
  totalScore: number;
}

export interface ScoreboardEntry {
  name: string;
  score: number;
  rank: number;
}

export const calculateScore = (
  timeLimitSec: number,
  questionStartTime: number,
  answerTimestamp: number
): number => {
  const timeElapsedSec = (answerTimestamp - questionStartTime) / 1000;
  const timeRemaining = Math.max(0, timeLimitSec - timeElapsedSec);
  return Math.round(BASE_POINTS * (timeRemaining / timeLimitSec));
};

export const generatePlayerResults = (
  game: Game,
  correctIndex: number
): PlayerResult[] => {
  const currentQuestion = game.questions[game.currentQuestion];
  const timeLimitSec = currentQuestion.timeLimitSec;

  return game.players.map(player => {
    const isHost = player.index === game.hostId;

    if (isHost) {
      return {
        name: player.name,
        answered: false,
        correct: false,
        pointsEarned: 0,
        totalScore: player.score,
      };
    }

    const answer = game.playerAnswers.get(player.index);

    if (!answer) {
      return {
        name: player.name,
        answered: false,
        correct: false,
        pointsEarned: 0,
        totalScore: player.score,
      };
    }

    const isCorrect = answer.answerIndex === correctIndex;
    const pointsEarned = isCorrect
      ? calculateScore(timeLimitSec, game.questionStartTime!, answer.timestamp)
      : 0;

    return {
      name: player.name,
      answered: true,
      correct: isCorrect,
      pointsEarned,
      totalScore: player.score,
    };
  });
};

export const generateScoreboard = (players: Player[]): ScoreboardEntry[] => {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  const scoreboard: ScoreboardEntry[] = [];
  let currentRank = 1;

  sorted.forEach((player, index) => {
    if (index > 0 && sorted[index - 1].score !== player.score) {
      currentRank = index + 1;
    }

    scoreboard.push({
      name: player.name,
      score: player.score,
      rank: currentRank,
    });
  });

  return scoreboard;
};
