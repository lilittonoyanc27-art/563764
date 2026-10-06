/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Languages,
  HelpCircle,
  Users,
  Percent,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  Volume1,
  ListOrdered
} from 'lucide-react';
import { OptionKey, GameMode, LifelineStatus, AudienceResult, AnswerHistory } from './types.ts';
import { QUESTIONS, LADDER_15_PRIZES } from './questions.ts';
import {
  playSelectSound,
  playCorrectSound,
  playWrongSound,
  playLifelineSound,
  playWinSound,
  speakSpanish,
  setMuted,
  getMuted
} from './sounds.ts';

export default function App() {
  // Game mode
  const [mode, setMode] = useState<GameMode>('ladder15');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
  const [isAnswerLocked, setIsAnswerLocked] = useState<boolean>(false);
  const [revealedResult, setRevealedResult] = useState<boolean>(false);

  // Lifelines
  const [lifelines, setLifelines] = useState<LifelineStatus>({
    fiftyFiftyUsed: false,
    audienceUsed: false,
    hintUsed: false,
  });
  const [eliminatedOptions, setEliminatedOptions] = useState<OptionKey[]>([]);
  const [audienceResult, setAudienceResult] = useState<AudienceResult | null>(null);
  const [showHintModal, setShowHintModal] = useState<boolean>(false);

  // Translations visibility toggles (Click Spanish to reveal Armenian)
  const [showAllTranslations, setShowAllTranslations] = useState<boolean>(false);
  const [revealedArmenianQuestions, setRevealedArmenianQuestions] = useState<Record<number, boolean>>({});
  const [revealedArmenianOptions, setRevealedArmenianOptions] = useState<Record<string, boolean>>({});

  // Stats and history
  const [history, setHistory] = useState<AnswerHistory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLadderOpenMobile, setIsLadderOpenMobile] = useState<boolean>(false);
  const [isGameFinished, setIsGameFinished] = useState<boolean>(false);
  const [filterView, setFilterView] = useState<'all' | 'past' | 'future'>('all');

  // Prepare questions for mode
  const activeQuestions = useMemo(() => {
    if (mode === 'ladder15') {
      // Deterministic 15 varied questions covering both past and future
      const indices = [0, 2, 4, 7, 10, 13, 16, 19, 20, 23, 26, 29, 32, 36, 49];
      return indices.map((i) => QUESTIONS[i]);
    }
    if (filterView === 'past') {
      return QUESTIONS.filter((q) => q.tenseType === 'past');
    }
    if (filterView === 'future') {
      return QUESTIONS.filter((q) => q.tenseType === 'future');
    }
    return QUESTIONS;
  }, [mode, filterView]);

  const currentQ = activeQuestions[currentIndex] || activeQuestions[0];
  const totalQuestions = activeQuestions.length;

  // Sync audio mute state
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    setMuted(!nextState);
  };

  // Reset or change mode
  const startNewGame = (newMode: GameMode) => {
    setMode(newMode);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerLocked(false);
    setRevealedResult(false);
    setLifelines({ fiftyFiftyUsed: false, audienceUsed: false, hintUsed: false });
    setEliminatedOptions([]);
    setAudienceResult(null);
    setShowHintModal(false);
    setHistory([]);
    setIsGameFinished(false);
  };

  // Toggle Armenian translation for the question situation
  const toggleQuestionTranslation = (qId: number) => {
    setRevealedArmenianQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  // Toggle Armenian translation for an option
  const toggleOptionTranslation = (qId: number, optKey: OptionKey) => {
    const key = `${qId}_${optKey}`;
    setRevealedArmenianOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isQuestionTranslationVisible = (qId: number) => {
    return showAllTranslations || revealedArmenianQuestions[qId] || revealedResult;
  };

  const isOptionTranslationVisible = (qId: number, optKey: OptionKey) => {
    return showAllTranslations || revealedArmenianOptions[`${qId}_${optKey}`] || revealedResult;
  };

  // Lifeline 1: 50:50
  const handleFiftyFifty = () => {
    if (lifelines.fiftyFiftyUsed || isAnswerLocked || !currentQ) return;
    playLifelineSound();

    const wrongKeys: OptionKey[] = (['A', 'B', 'C', 'D'] as OptionKey[]).filter(
      (k) => k !== currentQ.correct
    );

    // Shuffle and pick 2 wrong answers to remove
    const shuffled = [...wrongKeys].sort(() => 0.5 - Math.random());
    const toEliminate = shuffled.slice(0, 2);

    setEliminatedOptions(toEliminate);
    setLifelines((prev) => ({ ...prev, fiftyFiftyUsed: true }));
  };

  // Lifeline 2: Ask the Audience
  const handleAudience = () => {
    if (lifelines.audienceUsed || isAnswerLocked || !currentQ) return;
    playLifelineSound();

    const correctKey = currentQ.correct;
    // 60-80% for the correct option
    const correctShare = Math.floor(Math.random() * 21) + 60;
    const remaining = 100 - correctShare;

    const wrongKeys: OptionKey[] = (['A', 'B', 'C', 'D'] as OptionKey[]).filter(
      (k) => k !== correctKey
    );

    // Distribute remaining
    const w1 = Math.floor(Math.random() * (remaining - 4)) + 1;
    const w2 = Math.floor(Math.random() * (remaining - w1 - 2)) + 1;
    const w3 = remaining - w1 - w2;

    const votes: Record<OptionKey, number> = {
      [correctKey]: correctShare,
      [wrongKeys[0]]: w1,
      [wrongKeys[1]]: w2,
      [wrongKeys[2]]: w3,
    } as Record<OptionKey, number>;

    setAudienceResult({ votes, recommended: correctKey });
    setLifelines((prev) => ({ ...prev, audienceUsed: true }));
  };

  // Lifeline 3: Grammar Hint
  const handleHint = () => {
    if (lifelines.hintUsed || isAnswerLocked || !currentQ) return;
    playLifelineSound();
    setShowHintModal(true);
    setLifelines((prev) => ({ ...prev, hintUsed: true }));
  };

  // Handle selecting an answer
  const handleSelectOption = (key: OptionKey) => {
    if (isAnswerLocked || eliminatedOptions.includes(key)) return;

    setSelectedOption(key);
    setIsAnswerLocked(true);
    playSelectSound();

    // Dramatic pause for suspense, then reveal
    setTimeout(() => {
      setRevealedResult(true);
      const isCorrect = key === currentQ.correct;

      if (isCorrect) {
        playCorrectSound();
      } else {
        // Even if incorrect, game will continue!
        playWrongSound();
      }

      setHistory((prev) => [
        ...prev,
        {
          questionId: currentQ.id,
          userAnswer: key,
          correctAnswer: currentQ.correct,
          isCorrect,
        },
      ]);
    }, 750);
  };

  // Advance to next question (game always continues!)
  const handleNextQuestion = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerLocked(false);
      setRevealedResult(false);
      setEliminatedOptions([]);
      setAudienceResult(null);
      setShowHintModal(false);
    } else {
      // Completed round
      playWinSound();
      setIsGameFinished(true);
    }
  };

  // Ladder current score calculation
  const correctCount = history.filter((h) => h.isCorrect).length;
  const currentPrizeAmount = useMemo(() => {
    if (mode === 'ladder15') {
      const ladderIndex = Math.min(currentIndex, LADDER_15_PRIZES.length - 1);
      return LADDER_15_PRIZES[ladderIndex]?.amount || '0 ֏';
    }
    // Marathon mode: proportionate points
    const points = correctCount * 20000;
    return `${points.toLocaleString()} ֏`;
  }, [mode, currentIndex, correctCount]);

  return (
    <div className="min-h-screen bg-[#050b1a] text-slate-100 flex flex-col font-sans select-none studio-glow">
      {/* Top Bar Contract (3 zones) */}
      <header className="border-b border-amber-900/30 bg-[#070e24]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#070e24] rounded-full flex items-center justify-center text-amber-400 font-display font-black text-xs">
              1M
            </div>
          </div>
          <div>
            <h1 className="text-base md:text-lg font-display font-bold tracking-wider text-amber-300">
              Ո՞վ է ուզում դառնալ միլիոնատեր
            </h1>
            <p className="text-[11px] text-amber-200/60 hidden sm:block">
              50 Situaciones — Pasado y Futuro (Իսպաներեն և Հայերեն)
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation modes */}
        <nav className="flex items-center gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-lg">
          <button
            onClick={() => startNewGame('ladder15')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              mode === 'ladder15'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Դասական (15 հարց)
          </button>
          <button
            onClick={() => startNewGame('marathon50')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              mode === 'marathon50'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Բոլոր 50-ը
          </button>
        </nav>

        {/* Zone 3: Primary actions & Audio */}
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={handleToggleSound}
            title={soundEnabled ? 'Անջատել ձայնը' : 'Միացնել ձայնը'}
            className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-amber-300/80 hover:text-amber-300 hover:bg-slate-800 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Master translation toggle */}
          <button
            onClick={() => setShowAllTranslations(!showAllTranslations)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap ${
              showAllTranslations
                ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {showAllTranslations ? 'Թաքցնել թարգմանությունը' : 'Ցույց տալ բոլորը'}
            </span>
            <span className="sm:hidden">🇦🇲</span>
          </button>

          {/* Mobile ladder button */}
          <button
            onClick={() => setIsLadderOpenMobile(!isLadderOpenMobile)}
            className="lg:hidden p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Zone: Question & Lifelines (Col 1-8) */}
        <main className="lg:col-span-8 flex flex-col gap-4 sm:gap-6">
          {/* Game Status Banner */}
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5 backdrop-blur-sm text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-display font-bold">
                Հարց {currentIndex + 1} / {totalQuestions}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-medium">
                Ճիշտ: {correctCount}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400 font-medium">
                Սխալ: {history.length - correctCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs hidden md:inline">Առանց ժամանակաչափի</span>
              <div className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-display font-semibold text-xs">
                {currentPrizeAmount}
              </div>
            </div>
          </div>

          {/* Lifelines Bar (Classic 3 Lifelines) */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 py-2">
            {/* 50:50 Lifeline */}
            <button
              onClick={handleFiftyFifty}
              disabled={lifelines.fiftyFiftyUsed || isAnswerLocked}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all shadow-md ${
                lifelines.fiftyFiftyUsed
                  ? 'bg-slate-900/40 border-slate-800 text-slate-600 line-through cursor-not-allowed'
                  : 'bg-gradient-to-b from-blue-900/40 to-slate-900 border-amber-500/50 text-amber-300 hover:border-amber-400 hover:scale-105 active:scale-95 shadow-amber-500/10'
              }`}
            >
              <Percent className="w-4 h-4 text-amber-400" />
              <span>50 : 50</span>
            </button>

            {/* Audience Poll */}
            <button
              onClick={handleAudience}
              disabled={lifelines.audienceUsed || isAnswerLocked}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all shadow-md ${
                lifelines.audienceUsed
                  ? 'bg-slate-900/40 border-slate-800 text-slate-600 line-through cursor-not-allowed'
                  : 'bg-gradient-to-b from-blue-900/40 to-slate-900 border-amber-500/50 text-amber-300 hover:border-amber-400 hover:scale-105 active:scale-95 shadow-amber-500/10'
              }`}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>Հանդիսատես</span>
            </button>

            {/* Grammar Hint */}
            <button
              onClick={handleHint}
              disabled={lifelines.hintUsed || isAnswerLocked}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all shadow-md ${
                lifelines.hintUsed
                  ? 'bg-slate-900/40 border-slate-800 text-slate-600 line-through cursor-not-allowed'
                  : 'bg-gradient-to-b from-blue-900/40 to-slate-900 border-amber-500/50 text-amber-300 hover:border-amber-400 hover:scale-105 active:scale-95 shadow-amber-500/10'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Հուշում</span>
            </button>
          </div>

          {/* Audience Poll Modal or Inline Display */}
          {audienceResult && (
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-4 shadow-xl text-xs sm:text-sm animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-amber-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  Հանդիսատեսի քվեարկության արդյունքները
                </span>
                <span className="text-slate-400 text-xs">
                  Առաջատար՝ <strong className="text-amber-400">Տարբերակ {audienceResult.recommended}</strong>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {(['A', 'B', 'C', 'D'] as OptionKey[]).map((k) => (
                  <div key={k} className="flex flex-col items-center">
                    <div className="w-full bg-slate-800 rounded-t-md h-24 flex items-end p-1 relative overflow-hidden">
                      <div
                        style={{ height: `${audienceResult.votes[k]}%` }}
                        className={`w-full rounded-t transition-all duration-700 ${
                          k === audienceResult.recommended
                            ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md'
                            : 'bg-slate-700'
                        }`}
                      />
                      <span className="absolute inset-0 flex items-center justify-center font-bold text-white text-xs drop-shadow">
                        {audienceResult.votes[k]}%
                      </span>
                    </div>
                    <span className="mt-1 font-bold text-amber-400">{k}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grammar Hint Modal */}
          {showHintModal && (
            <div className="bg-blue-950/80 border border-blue-500/50 rounded-xl p-4 shadow-xl text-xs sm:text-sm animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Քերականական ակնարկ ({currentQ.tenseLabelHy})
                </span>
                <button
                  onClick={() => setShowHintModal(false)}
                  className="text-slate-400 hover:text-white px-2 py-0.5"
                >
                  ✕ Փակել
                </button>
              </div>
              <p className="text-slate-200 mb-1">{currentQ.explanationHy}</p>
              <p className="text-slate-400 text-xs italic">{currentQ.explanationEs}</p>
            </div>
          )}

          {/* THE MILLIONAIRE QUESTION BOX */}
          <div className="relative">
            {/* Background glowing frame */}
            <div className="p-0.5 rounded-2xl bg-gradient-to-r from-amber-500/30 via-amber-400 to-amber-500/30 shadow-2xl">
              <div className="bg-[#0b1433] rounded-[15px] p-5 sm:p-7 relative overflow-hidden">
                {/* Situation Header with Tense Badge & Audio Speak */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold uppercase tracking-wider text-[11px]">
                      {currentQ.tenseType === 'past' ? '⏳ ԱՆՑՅԱԼ (PASADO)' : '🔮 ԱՊԱՌՆԻ (FUTURO)'}
                    </span>
                    <span className="text-slate-400 hidden sm:inline">
                      {currentQ.tenseLabelEs}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Speak question */}
                    <button
                      onClick={() => speakSpanish(currentQ.situationEs)}
                      title="Լսել իսպաներեն արտասանությունը"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-amber-300 text-xs transition-colors"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Լսել</span>
                    </button>

                    {/* Question translation trigger */}
                    <button
                      onClick={() => toggleQuestionTranslation(currentQ.id)}
                      className="text-xs text-blue-300 hover:text-blue-200 underline flex items-center gap-1"
                    >
                      🇦🇲 {isQuestionTranslationVisible(currentQ.id) ? 'Թաքցնել' : 'Թարգմանել'}
                    </button>
                  </div>
                </div>

                {/* Spanish Situation Text (Clickable to reveal translation!) */}
                <div
                  onClick={() => toggleQuestionTranslation(currentQ.id)}
                  className="cursor-pointer group rounded-lg p-2.5 -mx-2.5 hover:bg-slate-800/40 transition-colors"
                  title="Սեղմեք իսպաներեն տեքստին՝ հայերեն թարգմանությունը տեսնելու համար"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🇪🇸</span>
                    <p className="text-base sm:text-lg md:text-xl font-medium text-white leading-relaxed group-hover:text-amber-200 transition-colors">
                      {currentQ.situationEs}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-amber-400/80 italic font-mono">
                    <span>👆 Սեղմեք իսպաներեն տեքստին թարգմանության համար</span>
                  </div>
                </div>

                {/* Armenian Translation (Revealed on click or master toggle) */}
                {isQuestionTranslationVisible(currentQ.id) && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 text-slate-300">
                    <span className="text-xl">🇦🇲</span>
                    <p className="text-sm sm:text-base font-armenian text-amber-100 font-medium">
                      {currentQ.situationHy}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* THE 4 MILLIONAIRE OPTIONS (A, B, C, D) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {(['A', 'B', 'C', 'D'] as OptionKey[]).map((key) => {
              const option = currentQ.options[key];
              const isEliminated = eliminatedOptions.includes(key);
              const isSelected = selectedOption === key;
              const isCorrectAnswer = key === currentQ.correct;
              const translationOpen = isOptionTranslationVisible(currentQ.id, key);

              // Determine visual styling state
              let cardBg = 'bg-[#091129] hover:bg-[#0f1b40] border-slate-700 hover:border-amber-400';
              let badgeColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';

              if (isEliminated) {
                cardBg = 'opacity-20 pointer-events-none bg-slate-950 border-slate-900';
              } else if (revealedResult) {
                if (isCorrectAnswer) {
                  // Glowing Green Correct
                  cardBg = 'bg-emerald-950/80 border-emerald-400 text-white green-glow';
                  badgeColor = 'text-emerald-300 border-emerald-400 bg-emerald-500/30';
                } else if (isSelected) {
                  // Selected but wrong: Glowing Red/Rose
                  cardBg = 'bg-rose-950/80 border-rose-500 text-white red-glow';
                  badgeColor = 'text-rose-300 border-rose-500 bg-rose-500/30';
                }
              } else if (isSelected) {
                // Suspense locking in
                cardBg = 'bg-amber-950/80 border-amber-400 text-amber-100 animate-pulse gold-glow';
                badgeColor = 'text-amber-200 border-amber-300 bg-amber-500/40';
              }

              return (
                <div
                  key={key}
                  className={`group relative rounded-xl border-2 transition-all p-3 sm:p-4 text-left ${cardBg} ${
                    !isAnswerLocked && !isEliminated ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => {
                    if (!isAnswerLocked && !isEliminated) {
                      handleSelectOption(key);
                    }
                  }}
                >
                  {/* Top row: Badge, Spanish Sentence, Audio button, Translation trigger */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1">
                      {/* Option letter badge (A, B, C, D) */}
                      <span
                        className={`w-7 h-7 shrink-0 rounded-lg border font-display font-black text-sm flex items-center justify-center transition-colors ${badgeColor}`}
                      >
                        {key}
                      </span>

                      {/* Spanish Text (Clicking toggles translation without submitting if you click translation icon) */}
                      <div className="flex-1">
                        <span className="text-sm sm:text-base font-semibold text-slate-100 block">
                          {option.es}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {/* Speak this option */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakSpanish(option.es);
                        }}
                        title="Լսել արտասանությունը"
                        className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition-colors"
                      >
                        <Volume1 className="w-3.5 h-3.5" />
                      </button>

                      {/* Explicit translation toggle for this option */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOptionTranslation(currentQ.id, key);
                        }}
                        title="Թարգմանել հայերեն"
                        className="px-1.5 py-0.5 text-[11px] rounded bg-slate-800/90 text-amber-300/80 hover:text-amber-200 hover:bg-slate-700 transition-colors"
                      >
                        🇦🇲
                      </button>
                    </div>
                  </div>

                  {/* Armenian Translation (Revealed on click or when answered) */}
                  {translationOpen && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-xs sm:text-sm text-amber-300 font-armenian font-medium flex items-center gap-1.5 animate-in fade-in">
                      <span className="text-slate-400 font-sans text-xs">Թարգմ․</span>
                      <span>{option.hy}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feedback and "Continue Game" bar when an answer is revealed */}
          {revealedResult && (
            <div
              className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 ${
                selectedOption === currentQ.correct
                  ? 'bg-emerald-950/40 border-emerald-500/60'
                  : 'bg-slate-900/90 border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-3">
                {selectedOption === currentQ.correct ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-amber-400 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm sm:text-base">
                    {selectedOption === currentQ.correct ? (
                      <span className="text-emerald-400">Ճիշտ պատասխան! ¡Excelente!</span>
                    ) : (
                      <span className="text-amber-300">
                        Սխալ ընտրություն, բայց խաղը շարունակվում է։
                      </span>
                    )}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 font-armenian mt-0.5">
                    Ճիշտ տարբերակն է{' '}
                    <strong className="text-emerald-400">
                      [{currentQ.correct}] {currentQ.options[currentQ.correct].es}
                    </strong>{' '}
                    — {currentQ.options[currentQ.correct].hy}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 italic">
                    💡 {currentQ.explanationHy}
                  </p>
                </div>
              </div>

              {/* Continue button: advances to the next question */}
              <button
                onClick={handleNextQuestion}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all whitespace-nowrap"
              >
                <span>
                  {currentIndex + 1 < totalQuestions ? 'Հաջորդ հարցը' : 'Տեսնել արդյունքները'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick instructions / tips card */}
          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>💡</span>
              <span>
                Սեղմեք ցանկացած իսպաներեն նախադասության կամ <strong>🇦🇲</strong> կոճակին՝ թարգմանությունը տեսնելու համար։
              </span>
            </span>
            <span className="text-amber-400 font-medium hidden sm:inline">
              Անսահմանափակ ժամանակ
            </span>
          </div>
        </main>

        {/* Right Zone: Millionaire Ladder / Prize Tree (Col 9-12) */}
        <aside
          className={`lg:col-span-4 flex flex-col gap-4 ${
            isLadderOpenMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Ladder Card */}
          <div className="bg-[#070e24] border border-amber-900/40 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-900/40 pb-3 mb-3">
              <span className="font-display font-bold text-sm tracking-wider text-amber-300">
                ՄԻԼԻՈՆԱՏԵՐԻ ՍԱՆԴՈՒՂՔ
              </span>
              <span className="text-xs text-slate-400">
                {mode === 'ladder15' ? '15 Քայլ' : '50 Իրավիճակ'}
              </span>
            </div>

            {/* List of prize levels (Millionaire format: top prize at the top!) */}
            {mode === 'ladder15' ? (
              <div className="flex flex-col gap-1">
                {[...LADDER_15_PRIZES].reverse().map((item) => {
                  const qIdx = item.level - 1;
                  const isCurrent = currentIndex === qIdx;
                  const isPassed = currentIndex > qIdx;
                  const historyItem = history[qIdx];

                  let itemStyle = 'text-slate-400 bg-slate-900/30';
                  if (item.safe) {
                    itemStyle = 'text-white font-bold bg-amber-950/20'; // Milestone safe level
                  }
                  if (isPassed) {
                    itemStyle = historyItem?.isCorrect
                      ? 'text-emerald-400 bg-emerald-950/30 line-through'
                      : 'text-amber-400 bg-amber-950/30 line-through';
                  }
                  if (isCurrent) {
                    itemStyle =
                      'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20';
                  }

                  return (
                    <div
                      key={item.level}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${itemStyle}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-right font-display font-semibold">
                          {item.level}
                        </span>
                        {item.safe && !isCurrent && (
                          <span className="text-[10px] text-amber-400 font-bold">★</span>
                        )}
                      </div>
                      <span className="font-display tracking-wide">{item.amount}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Marathon mode 50 situations progress grid
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Ընթացք</span>
                  <span className="font-display text-amber-300 font-bold">
                    {currentIndex + 1} / 50
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / 50) * 100}%` }}
                  />
                </div>
                {/* 50 question mini-buttons to inspect / jump in practice */}
                <div className="grid grid-cols-10 gap-1 pt-2">
                  {QUESTIONS.map((q, idx) => {
                    const answered = history.find((h) => h.questionId === q.id);
                    let btnBg = 'bg-slate-900 border-slate-800 text-slate-400';
                    if (idx === currentIndex) {
                      btnBg = 'bg-amber-500 text-slate-950 font-bold border-amber-400';
                    } else if (answered) {
                      btnBg = answered.isCorrect
                        ? 'bg-emerald-900 text-emerald-200 border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border-rose-800';
                    }
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setSelectedOption(null);
                          setIsAnswerLocked(false);
                          setRevealedResult(false);
                          setEliminatedOptions([]);
                          setAudienceResult(null);
                          setShowHintModal(false);
                        }}
                        className={`text-[10px] h-7 rounded border font-mono transition-colors ${btnBg}`}
                        title={`Հարց ${q.id}: ${q.situationEs}`}
                      >
                        {q.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Practice Filter Selector */}
          {mode === 'marathon50' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs">
              <span className="text-slate-400 block mb-2 font-medium">
                Ֆիլտրել ըստ ժամանակաձևի՝
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => {
                    setFilterView('all');
                    setCurrentIndex(0);
                  }}
                  className={`py-1 rounded text-center transition-colors ${
                    filterView === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  Բոլորը (50)
                </button>
                <button
                  onClick={() => {
                    setFilterView('past');
                    setCurrentIndex(0);
                  }}
                  className={`py-1 rounded text-center transition-colors ${
                    filterView === 'past'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  Անցյալ (25)
                </button>
                <button
                  onClick={() => {
                    setFilterView('future');
                    setCurrentIndex(0);
                  }}
                  className={`py-1 rounded text-center transition-colors ${
                    filterView === 'future'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  Ապառնի (25)
                </button>
              </div>
            </div>
          )}

          {/* Restart round button */}
          <button
            onClick={() => startNewGame(mode)}
            className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Վերսկսել այս խաղափուլը</span>
          </button>
        </aside>
      </div>

      {/* Completion Modal / Game Summary */}
      {isGameFinished && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#091129] border-2 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl gold-glow animate-in zoom-in-95">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
              <Award className="w-9 h-9" />
            </div>

            <h3 className="font-display font-extrabold text-2xl text-amber-300 mb-1">
              Շնորհավորում ենք!
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Դուք ավարտեցիք բոլոր {totalQuestions} հարցերը։
            </p>

            <div className="grid grid-cols-3 gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6">
              <div>
                <span className="text-[11px] text-slate-400 block">Ճիշտ</span>
                <span className="text-xl font-bold text-emerald-400">{correctCount}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Սխալ</span>
                <span className="text-xl font-bold text-rose-400">
                  {totalQuestions - correctCount}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Շահում</span>
                <span className="text-xl font-bold text-amber-300 font-display">
                  {currentPrizeAmount}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => startNewGame('ladder15')}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm transition-all"
              >
                Խաղալ 15 հարցով
              </button>
              <button
                onClick={() => startNewGame('marathon50')}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
              >
                Խաղալ բոլոր 50-ը
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
