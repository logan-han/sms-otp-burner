/* eslint-disable react/prop-types */
import React from 'react';
import { IconCheck, IconCopy, IconPlus } from '../icons';
import { formatDuration } from '../format';

const NumberTab = ({ number, isActive, totalForNumber, onSelect, onCopy, isCopied }) => (
  <button
    role="tab"
    aria-selected={isActive}
    className={`num-tab${isActive ? ' on' : ''}`}
    onClick={onSelect}
  >
    <div className="num-tab-row">
      <div className="num-tab-label"><span className="num-tab-dot" /> number</div>
      <span
        className="num-tab-copy"
        role="button"
        tabIndex={0}
        onClick={(event) => { event.stopPropagation(); onCopy(); }}
        onKeyDown={(event) => { if (event.key === 'Enter') onCopy(); }}
        title="Copy number"
      >
        {isCopied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      </span>
    </div>
    <div className="num-tab-row"><span className="num-tab-num">{number.display}</span></div>
    <div className="num-tab-meta">
      <span className="num-tab-count">{totalForNumber}</span>
      <span>msg{totalForNumber === 1 ? '' : 's'}</span>
      <span className="sep">.</span>
      <span>{formatDuration(number.expiryDate)}</span>
    </div>
  </button>
);

export default function NumbersStrip({
  leasedNumbers,
  messages,
  activeNumber,
  onSelectNumber,
  onCopyNumber,
  copiedKey,
  canLeaseMore,
  isLeasing,
  isLoading,
  onLease,
}) {
  return (
    <section className="numbers-strip" role="tablist" aria-label="Filter by virtual number">
      <button
        role="tab"
        aria-selected={activeNumber === 'all'}
        className={`num-tab all${activeNumber === 'all' ? ' on' : ''}`}
        onClick={() => onSelectNumber('all')}
      >
        <div className="num-tab-label"><span className="num-tab-dot" /> all</div>
        <div className="num-tab-row">
          <span className="num-tab-num">All numbers</span>
        </div>
        <div className="num-tab-meta">
          <span className="num-tab-count">{messages.length}</span>
          <span>messages</span>
        </div>
      </button>

      {leasedNumbers.map((number) => (
        <NumberTab
          key={number.virtualNumber}
          number={number}
          isActive={activeNumber === number.virtualNumber}
          totalForNumber={messages.filter((m) => m.to === number.virtualNumber).length}
          onSelect={() => onSelectNumber(number.virtualNumber)}
          onCopy={() => onCopyNumber(number.virtualNumber)}
          isCopied={copiedKey === `num-${number.virtualNumber}`}
        />
      ))}

      {canLeaseMore && (
        <button className="num-tab lease-tab" onClick={onLease} disabled={isLeasing || isLoading}>
          <div className="num-tab-label"><IconPlus size={12} /> lease</div>
          <div className="num-tab-row"><span className="num-tab-num">{isLeasing ? 'Leasing...' : 'New number'}</span></div>
          <div className="num-tab-meta">request a Telstra virtual number</div>
        </button>
      )}
    </section>
  );
}
