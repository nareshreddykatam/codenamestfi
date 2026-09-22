import React, { useState } from 'react';
import { GameLogEntry } from '../types/game';
import { ScrollText, ChevronDown, ChevronUp } from 'lucide-react';

interface GameLogProps {
  logs: GameLogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`game-log-drawer ${isExpanded ? 'is-open' : 'is-collapsed'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="game-log-toggle-bar"
        aria-expanded={isExpanded}
      >
        <div className="log-toggle-left">
          <ScrollText size={16} />
          <span>MATCH ACTIVITY LOG ({logs.length} events)</span>
        </div>
        <div className="log-toggle-right">
          <span className="log-latest-snippet">
            {logs[0] ? logs[0].text : 'No events yet'}
          </span>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </button>

      {isExpanded && (
        <div className="game-log-body">
          <div className="log-entries-list">
            {logs.map((log) => (
              <div key={log.id} className={`log-item log-type-${log.type.toLowerCase()}`}>
                <span className="log-time">{log.timestamp}</span>
                <span className="log-text">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
