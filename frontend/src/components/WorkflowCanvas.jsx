import { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ProductUrlNode from './nodes/ProductUrlNode';
import DemographicsNode from './nodes/DemographicsNode';
import BrandStyleNode from './nodes/BrandStyleNode';
import GenerateNode from './nodes/GenerateNode';
import ImageNode from './nodes/ImageNode';
import PreviewNode from './nodes/PreviewNode';

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
  stroke: '#cfd0d2',
  strokeWidth: 2,
};

const activeEdgeStyle = {
  stroke: 'url(#edge-gradient)',
  strokeWidth: 2,
};

// Initial node positions
const initialNodes = [
  {
    id: 'productUrl',
    type: 'productUrl',
    position: { x: 50, y: 150 },
    data: { 
      status: 'active',
      productUrl: '',
      prompt: '',
    },
  },
  {
    id: 'demographics',
    type: 'demographics',
    position: { x: 500, y: 100 },
    data: { 
      status: 'pending',
      demographics: null,
    },
  },
  {
    id: 'brandStyle',
    type: 'brandStyle',
    position: { x: 950, y: 50 },
    data: { 
      status: 'pending',
      confirmedDemographics: null,
    },
  },
];

const initialEdges = [
  {
    id: 'e1-2',
    source: 'productUrl',
    target: 'demographics',
    sourceHandle: 'output',
    targetHandle: 'input',
    animated: true,
    style: activeEdgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' },
  },
  {
    id: 'e2-3',
    source: 'demographics',
    target: 'brandStyle',
    sourceHandle: 'output',
    targetHandle: 'input',
    animated: false,
    style: defaultEdgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cfd0d2' },
  },
  {
    id: 'e3-4',
    source: 'brandStyle',
    target: 'generate',
    sourceHandle: 'output',
    targetHandle: 'input',
    animated: false,
    style: defaultEdgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cfd0d2' },
  },
  {
    id: 'e4-5',
    source: 'generate',
    target: 'preview',
    sourceHandle: 'output',
    targetHandle: 'input',
    animated: false,
    style: defaultEdgeStyle,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cfd0d2' },
  },
];

export default function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // State for workflow data
  const [demographicsData, setDemographicsData] = useState(null);
  const [confirmedDemographics, setConfirmedDemographics] = useState(null);
  const [brandStyleData, setBrandStyleData] = useState(null);

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
            animated: isActive,
            style: isActive ? activeEdgeStyle : defaultEdgeStyle,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isActive ? '#8b5cf6' : '#4b5563',
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
  const handleBrandStyleConfirmed = useCallback((data) => {
    setBrandStyleData(data);
    
    // Update BrandStyle node to completed
    updateNodeStatus('brandStyle', 'completed');
    
    // Create 5 Generate nodes branching from BrandStyle
    const newNodes = [];
    const newEdges = [];
    
    for (let i = 0; i < 5; i++) {
      const nodeId = `generate-${i}`;
      // Fan out vertically
      const yPos = 100 + (i - 2) * 400; 
      
      newNodes.push({
        id: nodeId,
        type: 'generate',
        position: { x: 1400, y: yPos },
        data: {
          status: 'active',
          demographics: confirmedDemographics,
          brandStyle: data,
          index: i
        },
      });
      
      newEdges.push({
        id: `e-brand-gen-${i}`,
        source: 'brandStyle',
        target: nodeId,
        sourceHandle: 'output',
        targetHandle: 'input',
        animated: true,
        style: activeEdgeStyle,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
      });
    }

    setNodes((nds) => {
      // Remove original generate node and any existing generate nodes
      const filtered = nds.filter(n => n.id !== 'generate' && !n.id.startsWith('generate-'));
      return [...filtered, ...newNodes];
    });

    setEdges((eds) => {
      // Remove edges connected to original generate node
      const filtered = eds.filter(e => e.target !== 'generate' && !e.target.startsWith('generate-'));
      return [...filtered, ...newEdges];
    });
  }, [setNodes, setEdges, updateNodeStatus, confirmedDemographics]);

  // Handle image generation from a single GenerateNode
  const handleImageGenerated = useCallback((nodeId, data) => {
    // Get the first image (since each GenerateNode now generates 1 image)
    const image = data.images?.[0] || { image_url: data.image_url };
    
    // Update Generate node to completed
    updateNodeStatus(nodeId, 'completed');

    // Create ImageResult node for this generated image
    if (image.image_url) {
      setNodes((nds) => {
        // Check if image node already exists for this generate node
        const existingImageNode = nds.find(n => n.id === `image-${nodeId}`);
        if (existingImageNode) return nds;

        const sourceNode = nds.find(n => n.id === nodeId);
        const yPos = sourceNode ? sourceNode.position.y : 0;
        
        const newNode = {
          id: `image-${nodeId}`,
          type: 'imageResult',
          position: { x: 1850, y: yPos },
          data: {
            status: 'active',
            imageUrl: image.image_url,
            textPlacement: image.text_placement || data.text_placement,
          },
        };
        return [...nds, newNode];
      });

      setEdges((eds) => {
        // Check if edge already exists
        if (eds.find(e => e.target === `image-${nodeId}`)) return eds;
        
        return [...eds, {
          id: `e-${nodeId}-img`,
          source: nodeId,
          target: `image-${nodeId}`,
          sourceHandle: 'output',
          targetHandle: 'input',
          animated: true,
          style: activeEdgeStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        }];
      });
    }
  }, [setNodes, setEdges, updateNodeStatus]);

  // Handle individual image preview
  const handlePreviewImage = useCallback((nodeId, data) => {
     // Create a PreviewNode connected to this ImageNode
     const previewNodeId = `preview-${nodeId}`;
     
     setNodes((nds) => {
       // Check if exists
       if (nds.find(n => n.id === previewNodeId)) return nds;

       const sourceNode = nds.find(n => n.id === nodeId);
       const yPos = sourceNode ? sourceNode.position.y : 0;

       const newNode = {
         id: previewNodeId,
         type: 'preview',
         position: { x: 2300, y: yPos },
         data: {
           status: 'active',
           imageUrl: data.imageUrl,
           textPlacement: data.textPlacement
         }
       };
       return [...nds, newNode];
     });

     setEdges((eds) => {
       if (eds.find(e => e.target === previewNodeId)) return eds;
       
       return [...eds, {
         id: `e-${nodeId}-prev`,
         source: nodeId,
         target: previewNodeId,
         sourceHandle: 'output',
         targetHandle: 'input',
         animated: true,
         style: activeEdgeStyle,
         markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
       }];
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
      }
      if (node.id === 'generate' || node.id.startsWith('generate-')) {
        callbacks.onImageGenerated = (data) => handleImageGenerated(node.id, data);
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
    handleImageGenerated,
    handlePreviewImage,
    handleWorkflowComplete,
    updateNodeStatus,
    updateEdgeStatus,
  ]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

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
        fitViewOptions={{ padding: 0.2 }}
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

