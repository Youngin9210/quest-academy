import type { Player } from '../types';
import { QUEST_BONUS, QUEST_LEN, questDoneToday, questStreak } from '../game/quest';

export function QuestCard({ player, onStart }: { player: Player; onStart: () => void }) {
  const done = questDoneToday(player), streak = questStreak(player);
  return (
    <button className={`card quest-card ${done ? 'done' : ''}`} onClick={onStart}>
      <span className="quest-icon" aria-hidden="true">{done ? '✅' : '⭐'}</span>
      <span className="quest-text">
        <b>{done ? "Today's Quest is done!" : "Today's Quest"}</b>
        <span className="muted">{done ? 'Come back tomorrow for a new one. Tap to practice more.' : `${QUEST_LEN} questions from every subject · +${QUEST_BONUS} bonus`}</span>
      </span>
      {streak > 0 && <span className="chip quest-streak" title="quests in a row">⭐ {streak} day{streak === 1 ? '' : 's'}</span>}
      {!done && <span className="quest-go" aria-hidden="true">Go →</span>}
    </button>
  );
}
