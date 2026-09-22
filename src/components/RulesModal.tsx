import React from 'react';
import { X, Film, Shield, Users, Skull, AlertCircle } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="rules-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-modal-header">
          <div className="rules-title-group">
            <Film className="rules-icon" size={24} />
            <h2>How to Play Codenames TFI</h2>
          </div>
          <button onClick={onClose} className="close-modal-btn" aria-label="Close Rules">
            <X size={20} />
          </button>
        </div>

        <div className="rules-modal-body">
          <section className="rules-section">
            <h3><Users size={18} /> Game Setup & Roles</h3>
            <p>
              Two teams (<strong>RED</strong> and <strong>BLUE</strong>) compete. Each team has one <strong>Spymaster</strong> and one or more <strong>Operatives (Guessers)</strong>.
            </p>
            <ul>
              <li>The board consists of <strong>25 Telugu movie cards</strong> in a 5×5 grid.</li>
              <li>The starting team has <strong>9 cards</strong>, the opposing team has <strong>8 cards</strong>.</li>
              <li>There are <strong>7 Neutral / Bystander cards</strong> and <strong>1 lethal Assassin card</strong>.</li>
            </ul>
          </section>

          <section className="rules-section">
            <h3><Shield size={18} /> The Spymaster's Role</h3>
            <ul>
              <li>Spymasters switch on <strong>SPYMASTER VIEW</strong> to secretly see which movie cards belong to RED, BLUE, NEUTRAL, and ASSASSIN.</li>
              <li>Spymasters provide a <strong>one-word clue</strong> related to their team's movies, plus a <strong>number</strong> indicating how many movies on the board connect to that clue (e.g. <em>"MAHESH" 2</em> or <em>"POLICE" 3</em>).</li>
            </ul>
          </section>

          <section className="rules-section">
            <h3><Film size={18} /> The Operatives' Turn</h3>
            <ul>
              <li>Operatives discuss in <strong>OPERATIVE VIEW</strong> and click the movie cards they believe match the clue.</li>
              <li><strong>Your Team's Card:</strong> Correct! The card is revealed, and you may keep guessing up to <code>Clue Number + 1</code>.</li>
              <li><strong>Neutral Card:</strong> Revealed. Your turn immediately ends.</li>
              <li><strong>Opponent's Card:</strong> Revealed. Points given to your opponent and your turn ends immediately!</li>
              <li><strong>End Turn:</strong> You may click <em>End / Pass Turn</em> anytime after at least 1 guess.</li>
            </ul>
          </section>

          <section className="rules-section danger-section">
            <h3><Skull size={18} /> The Assassin Card</h3>
            <p>
              If a team clicks the <strong>ASSASSIN</strong> card, the game <strong>instantly ends in immediate defeat</strong>! The opposing team wins on the spot.
            </p>
          </section>

          <section className="rules-section">
            <h3><AlertCircle size={18} /> Victory Condition</h3>
            <p>
              The first team to reveal <strong>all of their assigned Telugu movie cards</strong> wins the match!
            </p>
          </section>
        </div>

        <div className="rules-modal-footer">
          <button onClick={onClose} className="btn-primary-gold">
            Got It, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
};
