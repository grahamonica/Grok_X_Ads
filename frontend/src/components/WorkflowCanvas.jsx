import { useCallback, useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ProductUrlNode from './nodes/ProductUrlNode';
import DemographicsNode from './nodes/DemographicsNode';
import BrandStyleNode from './nodes/BrandStyleNode';
import GenerateNode from './nodes/GenerateNode';
import ImageNode from './nodes/ImageNode';
import PreviewNode from './nodes/PreviewNode';

const PRIMARY_ROW_Y = 200;

// Custom node types
const nodeTypes = {
  productUrl: ProductUrlNode,
  demographics: DemographicsNode,
  brandStyle: BrandStyleNode,
  generate: GenerateNode,
  imageResult: ImageNode,
  preview: PreviewNode,
};

// Edge style with gradient
const defaultEdgeStyle = {
  stroke: '#ffffff',
  strokeWidth: 2,
};

const activeEdgeStyle = {
  stroke: 'url(#edge-gradient)',
  strokeWidth: 2,
};

const makeEdge = ({
  id,
  source,
  target,
  curved = false,
  animated = false,
  style = defaultEdgeStyle,
  color = '#cfd0d2',
}) => ({
  id,
  source,
  target,
  sourceHandle: 'output',
  targetHandle: 'input',
  type: curved ? 'smoothstep' : 'straight',
  animated,
  style,
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

const centeredOffsets = (count, spacing) => {
  if (count <= 1) return [0];
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => (i - mid) * spacing);
};

// Initial node positions
const initialNodes = [
  {
    id: 'productUrl',
    type: 'productUrl',
    position: { x: 50, y: PRIMARY_ROW_Y },
    data: { 
      status: 'active',
      productUrl: '',
      prompt: '',
      centerOffset: 0,
    },
  },
  {
    id: 'demographics',
    type: 'demographics',
    position: { x: 500, y: PRIMARY_ROW_Y },
    data: { 
      status: 'pending',
      demographics: null,
      centerOffset: 0,
    },
  },
  {
    id: 'brandStyle',
    type: 'brandStyle',
    position: { x: 950, y: PRIMARY_ROW_Y },
    data: { 
      status: 'pending',
      confirmedDemographics: null,
      centerOffset: 0,
    },
  },
];

const initialEdges = [
  makeEdge({
    id: 'e1-2',
    source: 'productUrl',
    target: 'demographics',
    curved: false,
    animated: false,
    style: activeEdgeStyle,
    color: '#ffffff',
  }),
  makeEdge({
    id: 'e2-3',
    source: 'demographics',
    target: 'brandStyle',
    curved: false,
    animated: false,
    style: defaultEdgeStyle,
    color: '#cfd0d2',
  }),
];

export default function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlow = useReactFlow();
  
  // State for workflow data
  const [demographicsData, setDemographicsData] = useState(null);
  const [confirmedDemographics, setConfirmedDemographics] = useState(null);
  const [brandStyleData, setBrandStyleData] = useState(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // Update node statuses
  const updateNodeStatus = useCallback((nodeId, status) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, status } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Update edge styling based on status
  const updateEdgeStatus = useCallback((edgeId, isActive) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            animated: false,
            style: isActive ? activeEdgeStyle : defaultEdgeStyle,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#ffffff',
            },
          };
        }
        return edge;
      })
    );
  }, [setEdges]);

  // Handle demographics received from API
  const handleDemographicsReceived = useCallback((data) => {
    setDemographicsData(data);
    
    // Update ProductUrl node to completed
    updateNodeStatus('productUrl', 'completed');
    
    // Update Demographics node to active with data
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === 'demographics') {
          return {
            ...node,
            data: {
              ...node.data,
              status: 'active',
              demographics: data,
            },
          };
        }
        return node;
      })
    );
    
    // Update edge
    updateEdgeStatus('e2-3', true);
  }, [setNodes, updateNodeStatus, updateEdgeStatus]);

  // Handle demographics confirmation
  const handleDemographicsConfirmed = useCallback((data) => {
    setConfirmedDemographics(data);
    
    // Update Demographics node to completed
    updateNodeStatus('demographics', 'completed');
    
    // Update BrandStyle node to active
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === 'brandStyle') {
          return {
            ...node,
            data: {
              ...node.data,
              status: 'active',
              confirmedDemographics: data,
            },
          };
        }
        return node;
      })
    );
    
    // Update edge
    updateEdgeStatus('e3-4', true);
  }, [setNodes, updateNodeStatus, updateEdgeStatus]);

  // Handle brand style confirmation
  const handleBrandStyleConfirmed = useCallback(async (data) => {
    setBrandStyleData(data);
    
    // Update BrandStyle node to active (will be completed after images are generated)
    updateNodeStatus('brandStyle', 'active');
    setIsGeneratingImages(true);
    
    if (!confirmedDemographics) {
      console.error('Missing demographics data');
      setIsGeneratingImages(false);
      return;
    }

    // Convert age_range object to string format
    let ageRangeStr = null;
    if (confirmedDemographics.age_range) {
      const { min, max } = confirmedDemographics.age_range;
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

    // Prepare request data
    const requestData = {
      product_url: confirmedDemographics.product_url,
      gender: confirmedDemographics.gender,
      age_range: ageRangeStr,
      language: confirmedDemographics.language?.join(', ') || null,
      location: confirmedDemographics.location?.join(', ') || null,
      colors: data.colors,
      mood: data.mood,
      product_description: data.productDescription,
      num_images: 3,
    };

    try {
      // Call the image generation API directly
      const response = await fetch('/generate-ad-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate ad images');
      }

      const result = await response.json();
      const images = result.images || [{ image_url: result.image_url }];
      
      // Update BrandStyle node to completed
      updateNodeStatus('brandStyle', 'completed');
      setIsGeneratingImages(false);
      
      // Create 3 Image nodes directly from the response
      const newNodes = [];
      const newEdges = [];
      const offsets = centeredOffsets(images.length, 480);
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const nodeId = `image-${i}`;
        const brandNode = nodes.find((n) => n.id === 'brandStyle');
        const baseY = brandNode?.position?.y ?? PRIMARY_ROW_Y;
        const yPos = baseY + offsets[i];
        
        newNodes.push({
          id: nodeId,
          type: 'imageResult',
          position: { x: 1400, y: yPos },
          data: {
            status: 'active',
            imageUrl: image.image_url,
            textPlacement: image.text_placement,
            centerOffset: offsets[i],
          },
        });
        
        newEdges.push(makeEdge({
          id: `e-brand-img-${i}`,
          source: 'brandStyle',
          target: nodeId,
          curved: images.length > 1,
          animated: false,
          style: activeEdgeStyle,
          color: '#ffffff',
        }));
      }

      setNodes((nds) => {
        // Remove original generate node and any existing generate/image nodes
        const filtered = nds.filter(n => 
          n.id !== 'generate' && 
          !n.id.startsWith('generate-') && 
          !n.id.startsWith('image-')
        );
        return [...filtered, ...newNodes];
      });

      setEdges((eds) => {
        // Remove edges connected to original generate node
        const filtered = eds.filter(e => 
          e.target !== 'generate' && 
          !e.target.startsWith('generate-') &&
          !e.target.startsWith('image-')
        );
        return [...filtered, ...newEdges];
      });
    } catch (error) {
      console.error('Error generating images:', error);
      // Revert brand style status on error
      updateNodeStatus('brandStyle', 'active');
      setIsGeneratingImages(false);
    }
  }, [setNodes, setEdges, updateNodeStatus, confirmedDemographics]);


  // Handle individual image preview
  const handlePreviewImage = useCallback((nodeId, data) => {
     // Create a PreviewNode connected to this ImageNode
     const previewNodeId = `preview-${nodeId}`;
     
     setNodes((nds) => {
       // Check if exists
       if (nds.find(n => n.id === previewNodeId)) return nds;

       const sourceNode = nds.find(n => n.id === nodeId);
       const yPos = sourceNode ? sourceNode.position.y : 0;
       const centerOffset = sourceNode?.data?.centerOffset ?? 0;

       const newNode = {
         id: previewNodeId,
         type: 'preview',
         position: { x: 2300, y: yPos },
         data: {
           status: 'active',
           imageUrl: data.imageUrl,
           textPlacement: data.textPlacement,
           centerOffset,
         }
       };
       return [...nds, newNode];
     });

     setEdges((eds) => {
       if (eds.find(e => e.target === previewNodeId)) return eds;
       
       return [...eds, makeEdge({
         id: `e-${nodeId}-prev`,
         source: nodeId,
         target: previewNodeId,
         curved: false,
         animated: false,
         style: activeEdgeStyle,
         color: '#ffffff',
       })];
     });

     // Mark image node as completed
     updateNodeStatus(nodeId, 'completed');

  }, [setNodes, setEdges, updateNodeStatus]);

  // Handle workflow complete
  const handleWorkflowComplete = useCallback(() => {
    // Mark all preview nodes as completed
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id.startsWith('preview-')) {
          return { ...node, data: { ...node.data, status: 'completed' } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Memoized nodes with callbacks
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => {
      const callbacks = {};
      
      if (node.id === 'productUrl') {
        callbacks.onDemographicsReceived = handleDemographicsReceived;
      }
      if (node.id === 'demographics') {
        callbacks.onDemographicsConfirmed = handleDemographicsConfirmed;
      }
      if (node.id === 'brandStyle') {
        callbacks.onBrandStyleConfirmed = handleBrandStyleConfirmed;
        callbacks.isGeneratingImages = isGeneratingImages;
      }
      if (node.id.startsWith('image-')) {
        callbacks.onPreview = () => handlePreviewImage(node.id, node.data);
      }
      if (node.id === 'preview' || node.id.startsWith('preview-')) {
        callbacks.onComplete = handleWorkflowComplete;
      }
      
      return {
        ...node,
        data: { ...node.data, ...callbacks },
      };
    });
  }, [
    nodes,
    handleDemographicsReceived,
    handleDemographicsConfirmed,
    handleBrandStyleConfirmed,
    handlePreviewImage,
    handleWorkflowComplete,
    updateNodeStatus,
    updateEdgeStatus,
  ]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'straight', animated: false }, eds)),
    [setEdges]
  );

  // Auto-fit the view to center and zoom to content
  useEffect(() => {
    if (!reactFlow) return;
    const fit = () =>
      reactFlow.fitView({
        padding: 0.38,
        includeHiddenNodes: true,
        minZoom: 0.2,
        maxZoom: 1.5,
      });
    fit();
  }, [reactFlow, nodes.length, edges.length]);

  return (
    <div className="workflow-app" style={{ width: '100vw', height: '100vh' }}>
      <div className="workflow-topbar">
        <div className="xai-mark">
          <span className="xai-text">xAI</span>
        </div>
        <div className="workflow-topbar-title">Ad Workflow</div>
      </div>
      <div className="flow-shell">
      {/* SVG Gradient Definitions */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, includeHiddenNodes: true }}
        nodeOrigin={[0.5, 0.5]}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant="dots" 
          gap={20} 
          size={1} 
          color="rgba(255, 255, 255, 0.12)" 
        />
        <Controls 
          position="bottom-left"
          showInteractive={false}
        />
        <MiniMap 
          position="bottom-right"
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'active':
                return '#ffffff';
              case 'completed':
                return '#dcdcdc';
              default:
                return '#cfd0d2';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.82)"
        />
      </ReactFlow>
      </div>
    </div>
  );
}
