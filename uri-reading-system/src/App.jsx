import { useState } from 'react'
import TabBookEval from './components/TabBookEval'
import TabReaction from './components/TabReaction'
import TabLibrary from './components/TabLibrary'
import './App.css'

export default function App() {
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    { label: '📚 책 평가', component: <TabBookEval /> },
    { label: '💬 유리 반응', component: <TabReaction /> },
    { label: '🗂️ 라이브러리', component: <TabLibrary /> },
  ]

  return (
    <div className="app">
      <header className="app-header">
        <h1>📖 유리 독서 시스템</h1>
      </header>
      <nav className="tab-nav">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`tab-btn ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="tab-content">
        {tabs[activeTab].component}
      </main>
    </div>
  )
}
