import React, { useState, useEffect } from 'react';

/**
 * Shows colored dots with initials for each connected collaborator.
 * Driven by the Yjs Awareness instance.
 */
export default function CollaboratorAvatars({ awareness, currentUser }) {
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    if (!awareness) {
      setPeers([]);
      return;
    }

    function updatePeers() {
      const states = awareness.getStates();
      const peerList = [];

      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return; // skip self
        if (state.user) {
          peerList.push({
            clientId,
            displayName: state.user.displayName || 'Anonymous',
            color: state.user.color || '#888',
            uid: state.user.uid,
          });
        }
      });

      // Deduplicate by uid (a user might have multiple tabs)
      const seen = new Set();
      const unique = peerList.filter((p) => {
        if (seen.has(p.uid)) return false;
        seen.add(p.uid);
        return true;
      });

      setPeers(unique);
    }

    awareness.on('change', updatePeers);
    updatePeers();

    return () => {
      awareness.off('change', updatePeers);
    };
  }, [awareness, currentUser]);

  if (peers.length === 0) return null;

  return (
    <div className="collaborator-avatars">
      {peers.map((peer) => {
        const initials = peer.displayName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <div
            key={peer.uid}
            className="collaborator-avatar"
            style={{ backgroundColor: peer.color }}
            title={peer.displayName}
          >
            {initials}
          </div>
        );
      })}
    </div>
  );
}
