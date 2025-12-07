import { memo, useEffect, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

const PREVIEW_COUNT = 10;
const AD_INTERVAL = 3; // every 3rd item is the ad

const parseJsonlFeed = (text, maxItems) => {
  const lines = text.split('\n').filter(Boolean);
  const tweets = [];
  for (const line of lines) {
    if (tweets.length >= maxItems) break;
    try {
      const entry = JSON.parse(line);
      const tweet = entry?.tweet;
      const users = entry?.includes?.users || [];
      const author = users.find((u) => u.id === tweet?.author_id) || {};
      tweets.push({
        id: tweet?.id || Math.random().toString(36).slice(2),
        authorName: author.name || 'Foodie',
        authorHandle: author.username ? `@${author.username}` : '@foodie',
        text: tweet?.text || '',
      });
    } catch (e) {
      // skip malformed
    }
  }
  return tweets;
};

const buildDisplayFeed = (tweets, imageUrl) => {
  const items = [];
  let tweetIndex = 0;
  // Need total PREVIEW_COUNT items, with every AD_INTERVALth as ad
  for (let i = 0; i < PREVIEW_COUNT; i++) {
    const position = i + 1;
    if (position % AD_INTERVAL === 0) {
      items.push({ type: 'ad', key: `ad-${position}`, imageUrl });
    } else if (tweetIndex < tweets.length) {
      items.push({ type: 'tweet', key: `tweet-${position}`, ...tweets[tweetIndex] });
      tweetIndex += 1;
    }
  }
  return items;
};

const PreviewNode = memo(({ data, selected }) => {
  const statusClass = data.status || 'pending';
  const imageUrl = data.imageUrl;
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const shouldLoadFeed = statusClass !== 'pending';

  // Load feed data (first 7 tweets; 3 positions will be ads -> total 10 items)
  useEffect(() => {
    let cancelled = false;

    if (!shouldLoadFeed) {
      setLoading(false);
      setError(null);
      setFeedItems([]);
      return () => {
        cancelled = true;
      };
    }

    const loadFeed = async () => {
      setLoading(true);
      setError(null);
      try {
        const origin = window.location.origin;
        const primaryUrl = `${origin}/data/foodie_homechef.jsonl`;
        const fallbackUrl = `${origin}/app/data/foodie_homechef.jsonl`;

        let res = await fetch(primaryUrl);
        if (!res.ok) {
          // try fallback path (reverse proxy /app)
          res = await fetch(fallbackUrl);
        }

        if (!res.ok) throw new Error('Failed to load feed data');
        const raw = await res.text();
        const tweets = parseJsonlFeed(raw, 7); // 7 tweets + 3 ads = 10
        if (!cancelled) setFeedItems(tweets);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadFeed();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadFeed]);

  const displayFeed = useMemo(() => buildDisplayFeed(feedItems, imageUrl), [feedItems, imageUrl]);

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`} style={{ minWidth: '360px' }}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '5'}
      </div>

      {/* Input Handle */}
      <Handle type="target" position={Position.Left} id="input" style={{ background: '#8b5cf6' }} />

      {/* Header */}
      <div className="node-header">
        <div className="node-header-icon">📱</div>
        <div className="node-header-title">Preview</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">iPhone feed preview. Every 3rd card is your promoted ad.</div>
      </div>

      {/* Content */}
      <div className="node-content">
        {statusClass === 'pending' ? (
          <div className="iphone-frame" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="iphone-feed-placeholder" style={{ width: '100%' }}>
              Complete previous steps to preview the feed on X!
            </div>
          </div>
        ) : (
          <div className="iphone-frame">
            {/* Status Bar */}
            <div className="iphone-status">
              <span className="iphone-time">9:41</span>
              <div className="iphone-status-icons">
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>

            {/* Feed */}
            <div className="iphone-feed">
              {loading && <div className="iphone-feed-placeholder">Loading feed...</div>}
              {error && <div className="iphone-feed-placeholder">{error}</div>}
              {!loading && !error && displayFeed.map((item) => {
                if (item.type === 'ad') {
                  return (
                    <div key={item.key} className="tweet-card promoted">
                      <div className="tweet-header">
                        <div className="tweet-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>🔥</div>
                        <div className="tweet-author">
                          <div className="tweet-name-row">
                            <span className="tweet-name">Your Brand</span>
                            <span className="tweet-handle">@yourbrand</span>
                          </div>
                          <span className="tweet-promoted">Promoted</span>
                        </div>
                      </div>
                      <div className="tweet-media">
                        {imageUrl ? (
                          <img src={`/proxy-image?image_url=${encodeURIComponent(imageUrl)}`} alt="Ad" />
                        ) : (
                          <div className="tweet-media-placeholder">Generate an image to preview</div>
                        )}
                      </div>
                      <div className="tweet-actions">
                        <span>💬 24</span>
                        <span>🔁 89</span>
                        <span>❤️ 312</span>
                        <span>👁️ 5.2K</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.key} className="tweet-card">
                    <div className="tweet-header">
                      <div className="tweet-avatar">🍳</div>
                      <div className="tweet-author">
                        <div className="tweet-name-row">
                          <span className="tweet-name">{item.authorName}</span>
                          <span className="tweet-handle">{item.authorHandle}</span>
                        </div>
                      </div>
                    </div>
                    <div className="tweet-text">{item.text || '...'}</div>
                    <div className="tweet-actions">
                      <span>💬 12</span>
                      <span>🔁 34</span>
                      <span>❤️ 128</span>
                      <span>👁️ 2.4K</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Warnings / Actions */}
        {statusClass === 'completed' && (
          <div className="node-success">
            <span>✓</span> Workflow completed successfully!
          </div>
        )}

        {!imageUrl && statusClass !== 'pending' && (
          <div className="node-error" style={{ marginTop: '8px' }}>
            <span>⚠</span> Generate an image to see the promoted ad preview.
          </div>
        )}

        {imageUrl && statusClass !== 'pending' && (
          <button
            className="node-button secondary"
            onClick={() => data.onComplete && data.onComplete()}
            style={{ marginTop: '8px' }}
          >
            ✓ Complete Workflow
          </button>
        )}

        {loading && statusClass !== 'pending' && <div className="node-loader" />}
        {error && statusClass !== 'pending' && <div className="node-error" style={{ marginTop: '8px' }}>{error}</div>}
      </div>
    </div>
  );
});

PreviewNode.displayName = 'PreviewNode';

export default PreviewNode;
