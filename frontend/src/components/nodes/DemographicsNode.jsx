import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

const AGE_RANGES = [
  { label: 'All ages', value: 'null-null' },
  { label: '13-24', value: '13-24' },
  { label: '13-34', value: '13-34' },
  { label: '18-24', value: '18-24' },
  { label: '18-34', value: '18-34' },
  { label: '18-49', value: '18-49' },
  { label: '18+', value: '18-null' },
  { label: '25-49', value: '25-49' },
  { label: '25+', value: '25-null' },
  { label: '35+', value: '35-null' },
  { label: '50+', value: '50-null' },
];

const DemographicsNode = memo(({ data, selected }) => {
  const [productUrl, setProductUrl] = useState('');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('null-null');
  const [language, setLanguage] = useState('');
  const [location, setLocation] = useState('');
  const [intent, setIntent] = useState('');

  // Update fields when demographics data is received
  useEffect(() => {
    if (data.demographics) {
      const d = data.demographics;
      setProductUrl(d.product_url || '');
      setGender(d.gender || '');
      setIntent(d.intent || '');
      
      if (d.age_range) {
        const min = d.age_range.min ?? 'null';
        const max = d.age_range.max ?? 'null';
        setAgeRange(`${min}-${max}`);
      }
      
      if (Array.isArray(d.language)) {
        setLanguage(d.language.join(', '));
      }
      
      if (Array.isArray(d.location)) {
        setLocation(d.location.join(', '));
      }
    }
  }, [data.demographics]);

  const handleConfirm = useCallback(() => {
    const [minAge, maxAge] = ageRange.split('-');
    
    const confirmedData = {
      product_url: productUrl,
      gender,
      age_range: {
        min: minAge === 'null' ? null : parseInt(minAge),
        max: maxAge === 'null' ? null : parseInt(maxAge),
      },
      language: language ? language.split(',').map(l => l.trim()).filter(Boolean) : null,
      location: location ? location.split(',').map(l => l.trim()).filter(Boolean) : null,
      intent,
    };

    if (data.onDemographicsConfirmed) {
      data.onDemographicsConfirmed(confirmedData);
    }
  }, [productUrl, gender, ageRange, language, location, intent, data]);

  const statusClass = data.status || 'pending';

  return (
    <div className={`workflow-node ${statusClass} ${selected ? 'selected' : ''}`}>
      {/* Status Badge */}
      <div className={`node-status-badge ${statusClass}`}>
        {statusClass === 'completed' ? '✓' : '2'}
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
        <div className="node-header-icon">👥</div>
        <div className="node-header-title">Demographics</div>
        <div className="node-header-info">ⓘ</div>
        <div className="node-info-tooltip">
          Review and edit the target demographics for your ad campaign.
        </div>
      </div>

      {/* Content */}
      <div className="node-content">
        <div className="node-row">
          <div className="node-field">
            <label className="node-label">Gender</label>
            <select
              className="node-select"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              disabled={statusClass === 'pending' || statusClass === 'completed'}
            >
              <option value="">-- Select --</option>
              <option value="Any">Any</option>
              <option value="Woman">Woman</option>
              <option value="Man">Man</option>
            </select>
          </div>

          <div className="node-field">
            <label className="node-label">Age Range</label>
            <select
              className="node-select"
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              disabled={statusClass === 'pending' || statusClass === 'completed'}
            >
              {AGE_RANGES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="node-row">
          <div className="node-field">
            <label className="node-label">Languages</label>
            <input
              type="text"
              className="node-input"
              placeholder="English, Spanish"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={statusClass === 'pending' || statusClass === 'completed'}
            />
          </div>

          <div className="node-field">
            <label className="node-label">Locations</label>
            <input
              type="text"
              className="node-input"
              placeholder="United States"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={statusClass === 'pending' || statusClass === 'completed'}
            />
          </div>
        </div>

        <div className="node-field">
          <label className="node-label">Intent</label>
          <textarea
            className="node-textarea"
            placeholder="Your advertising intent..."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            disabled={statusClass === 'pending' || statusClass === 'completed'}
            style={{ minHeight: '60px' }}
          />
        </div>

        <button
          className="node-button"
          onClick={handleConfirm}
          disabled={statusClass === 'pending' || statusClass === 'completed' || !gender}
        >
          {statusClass === 'completed' ? 'Demographics Confirmed' : 'Confirm Demographics'}
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

DemographicsNode.displayName = 'DemographicsNode';

export default DemographicsNode;

