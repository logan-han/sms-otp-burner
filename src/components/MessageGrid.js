/* eslint-disable react/prop-types */
import React from 'react';
import { IconInbox } from '../icons';
import MessageCard from './MessageCard';

const EmptyState = ({ query, activeNumber }) => (
  <div className="empty-grid no-messages">
    <div className="empty-icon"><IconInbox size={32} /></div>
    <div className="empty-title">
      {query ? 'No matches' : activeNumber === 'all' ? 'Inbox empty' : 'Nothing on this number yet'}
    </div>
    <div className="empty-sub">
      {query ? 'Try a different search.' : 'Use a leased number to receive SMS codes and OTPs.'}
    </div>
  </div>
);

export default function MessageGrid({
  messages,
  numberByMsisdn,
  copiedKey,
  query,
  activeNumber,
  onOpen,
  onCopyOtp,
}) {
  return (
    <main className="grid main-content">
      {messages.length === 0 && <EmptyState query={query} activeNumber={activeNumber} />}
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          recipientDisplay={numberByMsisdn[message.to]?.display || message.to}
          copiedKey={copiedKey}
          onOpen={onOpen}
          onCopyOtp={onCopyOtp}
        />
      ))}
    </main>
  );
}
