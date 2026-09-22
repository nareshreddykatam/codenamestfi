import React from 'react';
import { AlertTriangle, PauseCircle } from 'lucide-react';

interface DisconnectionBannerProps {
  isPaused?: boolean;
  pauseReason?: string;
  hostTransferNotice?: string;
  onDismissNotice?: () => void;
}

export const DisconnectionBanner: React.FC<DisconnectionBannerProps> = ({
  isPaused,
  pauseReason,
  hostTransferNotice,
  onDismissNotice,
}) => {
  if (!isPaused && !hostTransferNotice) return null;

  return (
    <div className="disconnection-banner-root">
      {isPaused && (
        <div className="pause-notice-pill">
          <PauseCircle size={18} className="text-amber-400 animate-pulse" />
          <span>{pauseReason || 'Game is paused due to a player disconnection. Waiting for reconnection...'}</span>
        </div>
      )}

      {hostTransferNotice && (
        <div className="host-notice-pill" onClick={onDismissNotice}>
          <AlertTriangle size={18} className="text-yellow-400" />
          <span>{hostTransferNotice}</span>
          <span className="dismiss-hint">(click to dismiss)</span>
        </div>
      )}
    </div>
  );
};
