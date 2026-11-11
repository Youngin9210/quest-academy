// The row of subjects. It doesn't decide anything itself: the parent tells it which
// subject is selected and what to do when one is tapped ("controlled component").
import { SUBJECTS } from '../content';
import { SUBJECT_ORDER } from '../game/missions';

interface Props { selected: string; onSelect: (subject: string) => void }

export function SubjectTabs({ selected, onSelect }: Props) {
  return (
    <div className="subject-tabs" role="tablist" aria-label="Subjects">
      {SUBJECT_ORDER.map(s => (
        <button key={s} className="subject-tab" role="tab" aria-selected={s === selected} onClick={() => onSelect(s)}>
          <span className="ti" aria-hidden="true">{SUBJECTS[s].icon}</span>
          <span>{SUBJECTS[s].name}</span>
        </button>
      ))}
    </div>
  );
}
