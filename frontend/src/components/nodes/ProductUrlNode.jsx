import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

const ProductUrlNode = memo(({ data, selected }) => {
  const [productUrl, setProductUrl] = useState(data.productUrl || '');
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async () => {
    if (!productUrl.trim() || !prompt.trim()) {
      setError('Both fields are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/generate-demographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_url: productUrl, prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch demographics');
      }

      const result = await response.json();
      
      // Call the onDemographicsReceived callback to update the next node
      if (data.onDemographicsReceived) {
        data.onDemographicsReceived({
          ...result,
          product_url: productUrl,
          intent: prompt,
        });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [productUrl, prompt, data]);

  const statusClass = data.status || 'active';

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '1'}
      </div>

      {/* Header */}
      <div className="node-header">
        <div className="node-header-icon">🔗</div>
        <div className="node-header-title">Product URL</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">
          Enter your product URL and describe your target audience to get started.
        </div>
      </div>

      {/* Content */}
      <div className="node-content">
        <div className="node-field">
          <label className="node-label">Product URL</label>
          <input
            type="url"
            className="node-input"
            placeholder="https://example.com/product"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            disabled={isLoading || statusClass === 'completed'}
          />
        </div>

        <div className="node-field">
          <label className="node-label">Target Audience</label>
          <textarea
            className="node-textarea"
            placeholder="Who do you want to connect with?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading || statusClass === 'completed'}
          />
        </div>

        {error && (
          <div className="node-error">
            <span>⚠</span> {error}
          </div>
        )}

        {isLoading && <div className="node-loader" />}

        <button
          className="node-button"
          onClick={handleSubmit}
          disabled={isLoading || statusClass === 'completed'}
        >
          {isLoading ? 'Analyzing...' : statusClass === 'completed' ? 'Demographics Retrieved' : 'Get Demographics'}
        </button>
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

ProductUrlNode.displayName = 'ProductUrlNode';

export default ProductUrlNode;

