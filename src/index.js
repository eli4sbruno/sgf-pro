import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Este arquivo conecta o componente App.js ao index.html
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
