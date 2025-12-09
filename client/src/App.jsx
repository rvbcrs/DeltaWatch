import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import Editor from './Editor'
import Layout from './Layout'
import Settings from './Settings'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<Editor />} />
          <Route path="/edit/:id" element={<Editor />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
