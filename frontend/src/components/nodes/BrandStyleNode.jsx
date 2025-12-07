import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

const FONT_STYLES = [
  'Modern Sans-Serif',
  'Elegant Serif',
  'Bold Geometric',
  'Playful Rounded',
  'Minimalist Sans',
  'Classic Serif',
  'Tech Monospace',
];

const BrandStyleNode = memo(({ data, selected }) => {
  const [colors, setColors] = useState([]);
  const [newColor, setNewColor] = useState('');
  const [moods, setMoods] = useState([]);
  const [newMood, setNewMood] = useState('');
  const [fontStyle, setFontStyle] = useState('');
  const [slogan, setSlogan] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Auto-fill brand style when demographics are confirmed
  useEffect(() => {
    if (data.confirmedDemographics && data.status === 'active' && !isAutoFilling && colors.length === 0) {
      fetchBrandStyle(data.confirmedDemographics.product_url);
    }
  }, [data.confirmedDemographics, data.status]);

  const fetchBrandStyle = async (productUrl) => {
    setIsAutoFilling(true);
    try {
      const response = await fetch('/analyze-brand-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_url: productUrl }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.colors) setColors(result.colors);
        if (result.mood) setMoods([result.mood]);
        if (result.font_style) setFontStyle(result.font_style);
        if (result.slogan) setSlogan(result.slogan);
        if (result.product_description) setProductDescription(result.product_description);
      }
    } catch (err) {
      console.error('Failed to fetch brand style:', err);
    } finally {
      setIsAutoFilling(false);
    }
  };

  const addColor = useCallback(() => {
    if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor) && !colors.includes(newColor.toUpperCase())) {
      setColors([...colors, newColor.toUpperCase()]);
      setNewColor('');
    }
  }, [newColor, colors]);

  const removeColor = useCallback((color) => {
    setColors(colors.filter(c => c !== color));
  }, [colors]);

  const addMood = useCallback(() => {
    if (newMood && !moods.includes(newMood)) {
      setMoods([...moods, newMood]);
      setNewMood('');
    }
  }, [newMood, moods]);

  const removeMood = useCallback((mood) => {
    setMoods(moods.filter(m => m !== mood));
  }, [moods]);

  const handleConfirm = useCallback(() => {
    if (colors.length === 0 || moods.length === 0 || !fontStyle || !productDescription) {
      return;
    }

    const brandStyleData = {
      colors,
      mood: moods[0],
      fontStyle,
      slogan,
      productDescription,
    };

    if (data.onBrandStyleConfirmed) {
      data.onBrandStyleConfirmed(brandStyleData);
    }
  }, [colors, moods, fontStyle, slogan, productDescription, data]);

  const statusClass = data.status || 'pending';
  const isDisabled = statusClass === 'pending' || statusClass === 'completed';

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '3'}
      </div>

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: '#ffffff' }}
      />

      {/* Header */}
      <div className="node-header">
        <div className="node-header-title">Brand Style</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">
          Define your brand colors, mood, and styling for the ad.
        </div>
      </div>

      {/* Content */}
      <div className="node-content">
        {isAutoFilling && <div className="node-loader" />}

        {/* Colors */}
        <div className="node-field">
          <label className="node-label">Brand Colors</label>
          <div className="pills-container">
            {colors.map((color) => (
              <div key={color} className="pill">
                <span className="color-dot" style={{ backgroundColor: color }} />
                {color}
                {!isDisabled && (
                  <button className="remove-btn" onClick={() => removeColor(color)}>×</button>
                )}
              </div>
            ))}
          </div>
          {!isDisabled && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                className="node-input"
                placeholder="#FF5733"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addColor()}
                style={{ flex: 1 }}
              />
              <button className="node-button secondary" onClick={addColor} style={{ width: 'auto', padding: '10px 16px' }}>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Moods */}
        <div className="node-field">
          <label className="node-label">Brand Mood</label>
          <div className="pills-container">
            {moods.map((mood) => (
              <div key={mood} className="pill">
                {mood}
                {!isDisabled && (
                  <button className="remove-btn" onClick={() => removeMood(mood)}>×</button>
                )}
              </div>
            ))}
          </div>
          {!isDisabled && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                className="node-input"
                placeholder="Professional, Playful..."
                value={newMood}
                onChange={(e) => setNewMood(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMood()}
                style={{ flex: 1 }}
              />
              <button className="node-button secondary" onClick={addMood} style={{ width: 'auto', padding: '10px 16px' }}>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Font Style */}
        <div className="node-field">
          <label className="node-label">Font Style</label>
          <select
            className="node-select"
            value={fontStyle}
            onChange={(e) => setFontStyle(e.target.value)}
            disabled={isDisabled}
          >
            <option value="">-- Select --</option>
            {FONT_STYLES.map((style) => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>

        {/* Slogan */}
        <div className="node-field">
          <label className="node-label">Slogan (Optional)</label>
          <input
            type="text"
            className="node-input"
            placeholder="Your catchy tagline..."
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            disabled={isDisabled}
          />
        </div>

        {/* Product Description */}
        <div className="node-field">
          <label className="node-label">Product Description</label>
          <textarea
            className="node-textarea"
            placeholder="Detailed description of your product/service..."
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            disabled={isDisabled}
          />
        </div>

        <button
          className="node-button"
          onClick={handleConfirm}
          disabled={isDisabled || colors.length === 0 || moods.length === 0 || !fontStyle || !productDescription}
        >
          {statusClass === 'completed' ? 'Brand Style Confirmed' : 'Confirm Brand Style'}
        </button>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#ffffff' }}
      />
    </div>
  );
});

BrandStyleNode.displayName = 'BrandStyleNode';

export default BrandStyleNode;

