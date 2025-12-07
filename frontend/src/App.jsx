import { ReactFlowProvider } from '@xyflow/react';
import WorkflowCanvas from './components/WorkflowCanvas';
import './styles/nodes.css';

function App() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}

export default App;
