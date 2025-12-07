import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

const PreviewNode = memo(({ data, selected }) => {
  const [activeTab, setActiveTab] = useState('feed');

  const statusClass = data.status || 'pending';
  const imageUrl = data.imageUrl;

  const handleDownload = () => {
    if (!imageUrl) return;
    
    const link = document.createElement('a');
    link.href = `/proxy-image?image_url=${encodeURIComponent(imageUrl)}`;
    link.download = 'ad-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`} style={{ minWidth: '340px' }}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '5'}
      </div>

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: '#8b5cf6' }}
      />

      {/* Header */}
      <div className="node-header">
        <div className="node-header-icon">📱</div>
        <div className="node-header-title">Preview</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">
          Preview your ad as it would appear in a social media feed.
        </div>
      </div>

      {/* Content */}
      <div className="node-content">
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          background: 'rgba(26, 26, 36, 0.6)',
          padding: '4px',
          borderRadius: '10px'
        }}>
          <button
            onClick={() => setActiveTab('feed')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'feed' ? 'var(--node-active)' : 'transparent',
              color: activeTab === 'feed' ? 'white' : 'var(--muted)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Feed View
          </button>
          <button
            onClick={() => setActiveTab('standalone')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'standalone' ? 'var(--node-active)' : 'transparent',
              color: activeTab === 'standalone' ? 'white' : 'var(--muted)',
              fontFamily: 'Syne, sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Standalone
          </button>
        </div>

        {/* Preview Area */}
        {activeTab === 'feed' ? (
          /* iPhone Feed Mockup */
          <div style={{
            background: '#000',
            borderRadius: '24px',
            padding: '8px',
            border: '2px solid #333',
          }}>
            {/* Status Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 16px 8px',
              fontSize: '12px',
              color: '#e7e9ea',
            }}>
              <span>9:41</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>

            {/* Tweet Card */}
            <div style={{
              background: '#16181c',
              borderRadius: '12px',
              padding: '12px',
            }}>
              {/* Tweet Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}>
                  🔥
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#e7e9ea' }}>Your Brand</span>
                    <span style={{ color: '#71767b', fontSize: '13px' }}>@yourbrand</span>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    color: '#71767b',
                    background: 'rgba(29, 155, 240, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    Promoted
                  </span>
                </div>
              </div>

              {/* Tweet Image */}
              <div style={{
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#0f1419',
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {imageUrl ? (
                  <img 
                    src={`/proxy-image?image_url=${encodeURIComponent(imageUrl)}`} 
                    alt="Ad Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ color: '#71767b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                    Generate an image to preview
                  </div>
                )}
              </div>

              {/* Tweet Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '12px',
                color: '#71767b',
                fontSize: '12px',
              }}>
                <span>💬 24</span>
                <span>🔁 89</span>
                <span>❤️ 312</span>
                <span>👁️ 5.2K</span>
              </div>
            </div>
          </div>
        ) : (
          /* Standalone Preview */
          <div className="image-preview" style={{ aspectRatio: '1', borderRadius: '12px' }}>
            {imageUrl ? (
              <img 
                src={`/proxy-image?image_url=${encodeURIComponent(imageUrl)}`} 
                alt="Ad Preview"
              />
            ) : (
              <div className="image-preview-placeholder">
                Generate an image to preview
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {imageUrl && (
          <>
            <button
              className="node-button"
              onClick={handleDownload}
            >
              Download Image
            </button>

            {data.onComplete && (
              <button
                className="node-button secondary"
                onClick={() => data.onComplete()}
                style={{ marginTop: '8px' }}
              >
                ✓ Complete Workflow
              </button>
            )}
          </>
        )}

        {statusClass === 'completed' && (
          <div className="node-success">
            <span>✓</span> Workflow completed successfully!
          </div>
        )}
      </div>
    </div>
  );
});

PreviewNode.displayName = 'PreviewNode';

export default PreviewNode;

