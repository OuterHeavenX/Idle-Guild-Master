import type { QuestState } from '../content/story/ashenCryptIntro';
import { EMBERS_REWARD_ID, type StateManager } from '../core/StateManager';

export const EMBERS_QUEST_REWARD = Object.freeze({ gold: 150, shards: 5 });

const ALLOWED_TRANSITIONS: Readonly<Record<QuestState, readonly QuestState[]>> = {
  NOT_STARTED: ['INTRODUCED', 'ACCEPTED'],
  INTRODUCED: ['ACCEPTED', 'PARTY_MET'],
  ACCEPTED: ['PARTY_MET'],
  PARTY_MET: ['PREPARED'],
  PREPARED: ['ENTERED_CRYPT'],
  ENTERED_CRYPT: ['CRYPT_ATTEMPTED', 'CRYPT_CLEARED'],
  CRYPT_ATTEMPTED: ['ENTERED_CRYPT', 'CRYPT_CLEARED'],
  CRYPT_CLEARED: ['RETURNED_TO_GUILD'],
  RETURNED_TO_GUILD: ['COMPLETE'],
  COMPLETE: [],
};

const CRYPT_UNLOCKED: readonly QuestState[] = [
  'PREPARED', 'ENTERED_CRYPT', 'CRYPT_ATTEMPTED', 'CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE',
];

/** Owns legal progression for Embers Beneath the Crypt. */
export class QuestSystem {
  constructor(private readonly state: StateManager) {}

  get stage(): QuestState { return this.state.story.quest; }
  get rewardClaimed(): boolean { return this.state.hasClaimedReward(EMBERS_REWARD_ID); }

  canTransition(next: QuestState): boolean {
    return ALLOWED_TRANSITIONS[this.stage].includes(next);
  }

  transition(next: QuestState): boolean {
    if (next === this.stage) return true;
    if (!this.canTransition(next)) return false;
    this.state.setQuest(next);
    return true;
  }

  acceptQuest(): boolean {
    if (this.stage === 'NOT_STARTED') return this.transition('ACCEPTED');
    if (this.stage === 'INTRODUCED') return this.transition('ACCEPTED');
    return true;
  }

  meetParty(): boolean {
    if (this.stage === 'INTRODUCED' || this.stage === 'ACCEPTED') return this.transition('PARTY_MET');
    return this.stage === 'PARTY_MET' || this.isPast('PARTY_MET');
  }

  prepareAtForge(): boolean {
    if (this.stage === 'PARTY_MET') return this.transition('PREPARED');
    return this.stage === 'PREPARED' || this.isPast('PREPARED');
  }

  canEnterCrypt(): boolean {
    return CRYPT_UNLOCKED.includes(this.stage);
  }

  enterCrypt(): boolean {
    if (!this.canEnterCrypt()) return false;
    if (this.stage === 'PREPARED') return this.transition('ENTERED_CRYPT');
    if (this.stage === 'CRYPT_ATTEMPTED') return this.transition('ENTERED_CRYPT');
    return true;
  }

  recordDefeat(): boolean {
    if (this.stage !== 'ENTERED_CRYPT') return this.stage === 'CRYPT_ATTEMPTED';
    return this.transition('CRYPT_ATTEMPTED');
  }

  recordCryptVictory(encounterIndex = this.state.dungeon.ashenCrypt.encounterIndex): boolean {
    if (this.stage !== 'ENTERED_CRYPT' && this.stage !== 'CRYPT_ATTEMPTED') {
      return this.stage === 'CRYPT_CLEARED' || this.isPast('CRYPT_CLEARED');
    }
    this.state.markCryptVictory(encounterIndex);
    return true;
  }

  recordReturnToGuild(): boolean {
    if (this.stage === 'CRYPT_CLEARED') return this.transition('RETURNED_TO_GUILD');
    return this.stage === 'RETURNED_TO_GUILD' || this.stage === 'COMPLETE';
  }

  /** The reward ledger, currencies, and legacy COMPLETE flags are persisted atomically. */
  completeQuest(): { completed: boolean; rewardGranted: boolean } {
    if (!['CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE'].includes(this.stage)) {
      return { completed: false, rewardGranted: false };
    }
    const rewardGranted = this.state.claimReward(EMBERS_REWARD_ID, EMBERS_QUEST_REWARD);
    if (this.state.story.quest !== 'COMPLETE') this.state.setQuest('COMPLETE');
    return { completed: true, rewardGranted };
  }

  private isPast(stage: QuestState): boolean {
    const order: QuestState[] = [
      'NOT_STARTED', 'INTRODUCED', 'ACCEPTED', 'PARTY_MET', 'PREPARED',
      'ENTERED_CRYPT', 'CRYPT_ATTEMPTED', 'CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE',
    ];
    return order.indexOf(this.stage) > order.indexOf(stage);
  }
}
