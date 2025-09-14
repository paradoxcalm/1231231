import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ClientDashboard from './pages/ClientDashboard';
import Schedule from './pages/Schedule';
import Tariffs from './pages/Tariffs';
import Orders from './pages/Orders';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/tariffs" element={<Tariffs />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;