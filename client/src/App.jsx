import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import Editor from './Editor'
import Layout from './Layout'
import Settings from './Settings'
import MonitorDetails from './MonitorDetails'
import { ToastProvider } from './contexts/ToastContext'
import { DialogProvider } from './contexts/DialogContext'

function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<Editor />} />
              <Route path="/edit/:id" element={<Editor />} />
              <Route path="/monitor/:id" element={<MonitorDetails />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </DialogProvider>
    </ToastProvider>
  )
}

export default App
