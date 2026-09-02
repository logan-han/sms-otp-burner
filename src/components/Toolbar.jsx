/* eslint-disable react/prop-types */
import React from 'react';
import { IconInbox, IconRefresh, IconSearch, IconX } from '../icons';

export default function Toolbar({
  filteredCount,
  query,
  onQueryChange,
  isLoading,
  isRefreshing,
  canRefresh,
  onRefresh,
}) {
  return (
    <section className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-title">
          <IconInbox size={15} />
          <span>Inbox</span>
          <span className="toolbar-count mono">{filteredCount}</span>
        </div>
        <div className="search">
          <IconSearch size={14} />
          <input
            type="text"
            placeholder="Filter by sender, code, or text..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => onQueryChange('')} aria-label="Clear search">
              <IconX size={12} />
            </button>
          )}
        </div>
      </div>
      <button
        className={`btn refresh-btn ${isRefreshing ? 'spinning refreshing' : ''}`}
        onClick={onRefresh}
        disabled={isLoading || isRefreshing || !canRefresh}
      >
        <IconRefresh size={14} /> {isRefreshing ? 'checking...' : 'check for new'}
      </button>
    </section>
  );
}
