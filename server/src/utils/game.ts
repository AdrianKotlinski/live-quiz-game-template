import type { Game } from '../types';
import { broadcastToGame } from './message';
import { generatePlayerResults, generateScoreboard } from './scoring';
import { QUESTION_RESULT_DELAY } from '../constants';

export const broadcastQuestion = (game: Game): void => {
  const question = game.questions[game.currentQuestion];

  const questionData = {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.questions.length,
    text: question.text,
    options: question.options,
    timeLimitSec: question.timeLimitSec,
  };

  game.questionStartTime = Date.now();
  game.playerAnswers.clear();

  game.players.forEach(player => {
    player.hasAnswered = false;
    player.answerTime = undefined;
    player.answeredCorrectly = undefined;
  });

  broadcastToGame(game, 'question', questionData);

  game.questionTimer = setTimeout(() => {
    endQuestion(game);
  }, question.timeLimitSec * 1000);

  console.log(`Question ${game.currentQuestion + 1} broadcast for game ${game.code}`);
};

export const endQuestion = (game: Game): void => {
  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = undefined;
  }

  const currentQuestion = game.questions[game.currentQuestion];
  const correctIndex = currentQuestion.correctIndex;

  game.players.forEach(player => {
    const answer = game.playerAnswers.get(player.index);
    if (answer && answer.answerIndex === correctIndex) {
      const timeElapsedSec = (answer.timestamp - game.questionStartTime!) / 1000;
      const timeRemaining = Math.max(0, currentQuestion.timeLimitSec - timeElapsedSec);
      const pointsEarned = Math.round(1000 * (timeRemaining / currentQuestion.timeLimitSec));
      player.score += pointsEarned;
    }
  });

  const playerResults = generatePlayerResults(game, correctIndex);

  broadcastToGame(game, 'question_result', {
    questionIndex: game.currentQuestion,
    correctIndex,
    playerResults,
  });

  console.log(`Question ${game.currentQuestion + 1} ended for game ${game.code}`);

  setTimeout(() => {
    advanceToNextQuestion(game);
  }, QUESTION_RESULT_DELAY);
};

export const advanceToNextQuestion = (game: Game): void => {
  game.currentQuestion++;

  if (game.currentQuestion < game.questions.length) {
    broadcastQuestion(game);
  } else {
    finishGame(game);
  }
};

export const finishGame = (game: Game): void => {
  game.status = 'finished';

  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = undefined;
  }

  const scoreboard = generateScoreboard(game.players);

  broadcastToGame(game, 'game_finished', { scoreboard });

  console.log(`Game ${game.code} finished`);
};

export const checkAllPlayersAnswered = (game: Game): boolean => {
  const nonHostPlayers = game.players.filter(p => p.index !== game.hostId);
  return nonHostPlayers.every(p => game.playerAnswers.has(p.index));
};
