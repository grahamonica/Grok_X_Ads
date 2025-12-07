import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

const GenerateNode = memo(({ data, selected }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [promptUsed, setPromptUsed] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!data.demographics || !data.brandStyle) {
      setError('Missing demographics or brand style data');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const demographics = data.demographics;
      const brandStyle = data.brandStyle;

      // Convert age_range object to string format
      let ageRangeStr = null;
      if (demographics.age_range) {
        const { min, max } = demographics.age_range;
        if (min === null && max === null) {
          ageRangeStr = 'All';
        } else if (min === null) {
          ageRangeStr = `${max}-`;
        } else if (max === null) {
          ageRangeStr = `${min}+`;
        } else {
          ageRangeStr = `${min}-${max}`;
        }
      }

      const requestData = {
        product_url: demographics.product_url,
        gender: demographics.gender,
        age_range: ageRangeStr,
        language: demographics.language?.join(', ') || null,
        location: demographics.location?.join(', ') || null,
        colors: brandStyle.colors,
        mood: brandStyle.mood,
        product_description: brandStyle.productDescription,
      };

      const response = await fetch('/generate-ad-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate ad image');
      }

      const result = await response.json();
      setGeneratedImage(result.image_url);
      setPromptUsed(result.prompt_used || '');

      if (data.onImageGenerated) {
        data.onImageGenerated({
          imageUrl: result.image_url,
          promptUsed: result.prompt_used,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  const statusClass = data.status || 'pending';
  const isDisabled = statusClass === 'pending';

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`} style={{ minWidth: '380px' }}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '4'}
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
        <div className="node-header-icon">🖼️</div>
        <div className="node-header-title">Generate Ad</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">
          Generate your ad image based on the configured demographics and brand style.
        </div>
      </div>

      {/* Content */}
      <div className="node-content">
        {/* Summary */}
        {data.demographics && data.brandStyle && (
          <div style={{ 
            padding: '12px', 
            background: 'rgba(99, 102, 241, 0.1)', 
            borderRadius: '10px',
            fontSize: '12px',
            color: 'var(--muted)'
          }}>
            <div><strong>Target:</strong> {data.demographics.gender || 'Any'}, {
              data.demographics.age_range?.min && data.demographics.age_range?.max 
                ? `${data.demographics.age_range.min}-${data.demographics.age_range.max}`
                : data.demographics.age_range?.min 
                  ? `${data.demographics.age_range.min}+`
                  : 'All ages'
            }</div>
            <div><strong>Mood:</strong> {data.brandStyle.mood}</div>
            <div><strong>Colors:</strong> {data.brandStyle.colors?.slice(0, 3).join(', ')}</div>
          </div>
        )}

        {/* Image Preview */}
        <div className="image-preview">
          {generatedImage ? (
            <img src={`/proxy-image?image_url=${encodeURIComponent(generatedImage)}`} alt="Generated Ad" />
          ) : (
            <div className="image-preview-placeholder">
              {isDisabled 
                ? 'Complete previous steps to generate' 
                : 'Click Generate to create your ad image'}
            </div>
          )}
        </div>

        {/* Prompt Used */}
        {promptUsed && (
          <div style={{ 
            padding: '10px', 
            background: 'rgba(26, 26, 36, 0.6)', 
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--muted)',
            maxHeight: '60px',
            overflow: 'auto'
          }}>
            <strong>Prompt:</strong> {promptUsed}
          </div>
        )}

        {error && (
          <div className="node-error">
            <span>⚠</span> {error}
          </div>
        )}

        {isLoading && <div className="node-loader" />}

        <button
          className="node-button"
          onClick={handleGenerate}
          disabled={isDisabled || isLoading}
        >
          {isLoading ? 'Generating...' : generatedImage ? 'Regenerate Image' : 'Generate Ad Image'}
        </button>

        {generatedImage && (
          <button
            className="node-button secondary"
            onClick={() => data.onProceedToPreview && data.onProceedToPreview()}
            style={{ marginTop: '8px' }}
          >
            Proceed to Preview →
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

GenerateNode.displayName = 'GenerateNode';

export default GenerateNode;

