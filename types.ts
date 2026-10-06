export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  es: string;
  hy: string;
}

export interface Question {
  id: number;
  tenseType: 'past' | 'future';
  tenseLabelEs: string;
  tenseLabelHy: string;
  situationEs: string;
  situationHy: string;
  options: Record<OptionKey, QuestionOption>;
  correct: OptionKey;
  explanationEs: string;
  explanationHy: string;
}

export type GameMode = 'ladder15' | 'marathon50' | 'practice';

export interface LifelineStatus {
  fiftyFiftyUsed: boolean;
  audienceUsed: boolean;
  hintUsed: boolean;
}

export interface AudienceResult {
  votes: Record<OptionKey, number>;
  recommended: OptionKey;
}

export interface AnswerHistory {
  questionId: number;
  userAnswer: OptionKey;
  correctAnswer: OptionKey;
  isCorrect: boolean;
}
