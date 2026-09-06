import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {APIProvider} from '@vis.gl/react-google-maps';
import App from './App.tsx';
import './index.css';

const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <APIProvider apiKey={apiKey} libraries={['routes', 'marker']}>
      <App />
    </APIProvider>
  </StrictMode>,
);
