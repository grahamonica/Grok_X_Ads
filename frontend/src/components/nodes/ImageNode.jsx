import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ImageNode = memo(({ data, selected }) => {
  const statusClass = data.status || 'pending';
  const imageUrl = data.imageUrl;

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`} style={{ minWidth: '300px' }}>
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
        <div className="node-header-icon">🎨</div>
        <div className="node-header-title">Generated Image</div>
      </div>

      {/* Content */}
      <div className="node-content">
        {/* Image Preview */}
        <div className="image-preview">
          {imageUrl ? (
            <img 
              src={`/proxy-image?image_url=${encodeURIComponent(imageUrl)}`} 
              alt="Generated Ad" 
              style={{ width: '100%', borderRadius: '8px' }}
            />
          ) : (
            <div className="image-preview-placeholder">
              Waiting for generation...
            </div>
          )}
        </div>

        {/* Proceed Button */}
        {imageUrl && (
          <button
            className="node-button secondary"
            onClick={() => data.onPreview && data.onPreview()}
            style={{ marginTop: '12px' }}
          >
            Preview in Feed →
          </button>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#6366f1' }}
      />
    </div>
  );
});

ImageNode.displayName = 'ImageNode';

export default ImageNode;

