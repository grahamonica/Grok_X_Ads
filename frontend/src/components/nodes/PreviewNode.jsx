import { memo, useEffect, useMemo, useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';

const PREVIEW_COUNT = 10;
const AD_INTERVAL = 3; // every 3rd item is the ad

const findTweetMedia = (tweet, includes) => {
  const keys = tweet?.attachments?.media_keys || [];
  if (!keys.length) return null;

  const mediaMap = new Map((includes?.media || []).map((m) => [m.media_key, m]));
  for (const key of keys) {
    const media = mediaMap.get(key);
    if (!media) continue;
    if (media.type === 'photo' && media.url) return { type: 'photo', url: media.url };
    if (media.type === 'video' && media.preview_image_url) {
      return { type: 'video', url: media.preview_image_url };
    }
  }
  return null;
};

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
      const media = findTweetMedia(tweet, entry?.includes);
      tweets.push({
        id: tweet?.id || Math.random().toString(36).slice(2),
        authorName: author.name || 'Foodie',
        authorHandle: author.username ? `@${author.username}` : '@foodie',
        text: tweet?.text || '',
        media,
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
  const feedRef = useRef(null);
  const scrollPositionRef = useRef(0);

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
        const fallbackUrl = `${origin}/app/data/foodie_homechef.jsonl`

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
  
  // Duplicate feed for seamless looping
  const duplicatedFeed = useMemo(() => [...displayFeed, ...displayFeed], [displayFeed]);

  // Autoscroll animation
  useEffect(() => {
    if (!shouldLoadFeed || loading || error || !feedRef.current || displayFeed.length === 0) {
      return;
    }

    const feedElement = feedRef.current;
    const scrollSpeed = 0.8; // pixels per frame (higher = faster)
    let animationFrameId = null;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      if (!feedElement) return;

      const deltaTime = Math.min(currentTime - lastTime, 16); // Cap at 16ms for 60fps
      lastTime = currentTime;
      
      // Calculate scroll position
      scrollPositionRef.current += scrollSpeed * (deltaTime / 16); // normalize to 60fps
      
      // Get the height of a single feed (before duplication)
      const singleFeedHeight = feedElement.scrollHeight / 2;
      
      // If we've scrolled past one full feed, reset to start seamlessly
      if (scrollPositionRef.current >= singleFeedHeight) {
        scrollPositionRef.current = scrollPositionRef.current - singleFeedHeight;
      }
      
      feedElement.scrollTop = scrollPositionRef.current;
      
      animationFrameId = requestAnimationFrame(animate);
    };

    // Small delay before starting animation
    const startTimeout = setTimeout(() => {
      animationFrameId = requestAnimationFrame(animate);
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [shouldLoadFeed, loading, error, displayFeed.length]);

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`} style={{ minWidth: '360px' }}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '5'}
      </div>

      {/* Input Handle */}
      <Handle type="target" position={Position.Left} id="input" style={{ background: '#ffffff' }} />

      {/* Header */}
      <div className="node-header">
        <div className="node-header-title">Preview</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">iPhone feed preview. Every 3rd card is your promoted ad.</div>
      </div>

      {/* Content */}
      <div className="node-content">
        <div className="iphone-screen">
          {/* Status Bar */}
          <div className="iphone-status">
            <span className="iphone-time">9:41</span>
            <div className="iphone-status-icons">
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>

          {/* Top Tabs */}
          <div className="iphone-tabs">
            <div className="tab active">For you</div>
            <div className="tab">Following</div>
          </div>

          {/* Feed */}
          <div 
            ref={feedRef}
            className="iphone-feed"
            style={{ 
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollBehavior: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {statusClass === 'pending' && (
              <div className="iphone-feed-placeholder" style={{ width: '100%' }}>
                Complete previous steps to preview the feed on X!
              </div>
            )}
            {statusClass !== 'pending' && (
              <>
                {loading && <div className="iphone-feed-placeholder">Loading feed...</div>}
                {error && <div className="iphone-feed-placeholder">{error}</div>}
                {!loading && !error && duplicatedFeed.map((item, index) => {
                  if (item.type === 'ad') {
                    return (
                      <div key={`${item.key}-${index}`} className="tweet-card promoted">
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
                          <div className="action reply">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                            </svg>
                            <span>24</span>
                          </div>
                          <div className="action retweet">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                            </svg>
                            <span>89</span>
                          </div>
                          <div className="action like">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                            </svg>
                            <span>312</span>
                          </div>
                          <div className="action views">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
                            </svg>
                            <span>5.2K</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`${item.key}-${index}`} className="tweet-card">
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
                      {item.media?.url && (
                        <div className="tweet-media">
                          <img
                            src={`/proxy-image?image_url=${encodeURIComponent(item.media.url)}`}
                            alt="Tweet media"
                          />
                        </div>
                      )}
                      <div className="tweet-actions">
                        <div className="action reply">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                          </svg>
                          <span>12</span>
                        </div>
                        <div className="action retweet">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                          </svg>
                          <span>34</span>
                        </div>
                        <div className="action like">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                          </svg>
                          <span>128</span>
                        </div>
                        <div className="action views">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
                          </svg>
                          <span>2.4K</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Bottom Nav */}
          <div className="iphone-footer">
            <span className="footer-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21.75 9.75 12.53 3.04a.75.75 0 0 0-.9 0L2.25 9.75v10a.75.75 0 0 0 .75.75h6.5a.75.75 0 0 0 .75-.75v-5.5h3.5v5.5a.75.75 0 0 0 .75.75h6.5a.75.75 0 0 0 .75-.75v-10Z"></path>
              </svg>
            </span>
            <span className="footer-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.03l4.255 4.255a.75.75 0 1 1-1.06 1.06l-4.255-4.255A7.5 7.5 0 1 1 10.5 3Zm0 1.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"></path>
              </svg>
            </span>
            <span className="footer-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4a.75.75 0 0 1 .75.75V11h6.25a.75.75 0 0 1 0 1.5H12.75v6.25a.75.75 0 0 1-1.5 0V12.5H5a.75.75 0 0 1 0-1.5h6.25V4.75A.75.75 0 0 1 12 4Z"></path>
              </svg>
            </span>
            <span className="footer-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.993 9.042a8.062 8.062 0 0 0-15.996.84L2.866 18H1.5a.5.5 0 0 0 0 1h17a.5.5 0 0 0 0-1h-1.334l-1.173-8.958zM16.5 19a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"></path>
              </svg>
            </span>
            <span className="footer-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M1.998 4.499c0-.828.671-1.499 1.5-1.499h17c.828 0 1.5.671 1.5 1.499v2.422l-10 6.03-10-6.03V4.499zm0 4.422v10.579c0 .828.671 1.499 1.5 1.499h17c.828 0 1.5-.671 1.5-1.499V8.921l-10 6.03-10-6.03z"></path>
              </svg>
            </span>
          </div>
        </div>

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
